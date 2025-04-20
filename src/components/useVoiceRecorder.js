// useVoiceRecorder.js
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for voice recording with automatic silence detection
 *
 * @param {Object} options - Configuration options
 * @param {number} options.silenceThreshold - Level below which audio is considered silence (default: 5)
 * @param {number} options.speechThreshold - Level above which audio is considered speech (default: 15)
 * @param {number} options.silenceDuration - Time in ms before auto-stopping after silence (default: 2000)
 * @param {number} options.minRecordingTime - Minimum recording time before silence detection (default: 500)
 * @param {number} options.checkInterval - Interval in ms to check audio levels (default: 50)
 * @param {number} options.fftSize - FFT size for audio analysis (default: 128)
 * @param {number} options.smoothing - Smoothing constant for analyzer (default: 0.1)
 * @returns {Object} Recording state and control functions
 */
const useVoiceRecorder = (options = {}) => {
  // Default settings with ADJUSTED values for better sensitivity
  const settings = {
    silenceThreshold: options.silenceThreshold || 5,
    speechThreshold: options.speechThreshold || 15,
    silenceDuration: options.silenceDuration || 2000,
    minRecordingTime: options.minRecordingTime || 500,
    checkInterval: options.checkInterval || 50,
    fftSize: options.fftSize || 128,
    smoothing: options.smoothing || 0.1,
  };

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [hasSpeech, setHasSpeech] = useState(false);
  const [silenceDetected, setSilenceDetected] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [silenceCountdown, setSilenceCountdown] = useState(null);
  const [audioSamples, setAudioSamples] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceDetectorRef = useRef(null);
  const silenceStartRef = useRef(null);
  const recordingStartTimeRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mountedRef = useRef(true);

  // Tracking refs
  const hasSpeechRef = useRef(false);
  const silenceDetectedRef = useRef(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Clear silence detector interval
    if (silenceDetectorRef.current) {
      clearInterval(silenceDetectorRef.current);
      silenceDetectorRef.current = null;
    }

    // Stop and clean up media tracks
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    // Cancel any animation frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Close AudioContext if it exists
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (err) {
        console.error("Error closing AudioContext:", err);
      }
    }
  }, []);

  // Set up cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Add samples to audio visualizer data
  useEffect(() => {
    if (audioLevel > 0) {
      setAudioSamples(prev => {
        const newSamples = [...prev, audioLevel];
        return newSamples.length > 50 ? newSamples.slice(-50) : newSamples;
      });
    }
  }, [audioLevel]);

  // Update UI from refs
  useEffect(() => {
    const syncUI = () => {
      if (mountedRef.current) {
        setHasSpeech(hasSpeechRef.current);
        setSilenceDetected(silenceDetectedRef.current);
      }
    };

    const interval = setInterval(syncUI, 50);
    return () => clearInterval(interval);
  }, []);

  // Start recording function
  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) return;

    try {
      // Reset state
      setAudioLevel(0);
      setPeakLevel(0);
      setAudioSamples([]);
      setSilenceCountdown(null);
      setHasSpeech(false);
      setSilenceDetected(false);
      hasSpeechRef.current = false;
      silenceDetectedRef.current = false;
      silenceStartRef.current = null;
      audioChunksRef.current = [];

      setStatusMessage('Requesting microphone permissions...');

      // Clean up previous resources
      cleanup();

      // Close previous AudioContext if it exists
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
      }

      // Get microphone stream with explicit settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 44100
        }
      });

      audioStreamRef.current = stream;
      setStatusMessage('Microphone access granted. Starting recording...');

      // Create AudioContext and analyzer
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext({ sampleRate: 44100 });
      audioContextRef.current = audioContext;

      // Resume AudioContext if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Set up audio analysis for silence detection
      const audioSource = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;

      // Configure analyser for better sensitivity
      analyser.fftSize = settings.fftSize;
      analyser.smoothingTimeConstant = settings.smoothing;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      audioSource.connect(analyser);

      // Start tracking recording time
      recordingStartTimeRef.current = Date.now();

      // Create media recorder with explicit MIME type
      let options = {};

      // Try to use preferred MIME type with fallbacks
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      // The silence detection interval
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      silenceDetectorRef.current = setInterval(() => {
        if (!mountedRef.current) {
          clearInterval(silenceDetectorRef.current);
          return;
        }

        // Get current audio data
        analyser.getByteFrequencyData(dataArray);

        // Calculate average audio level - improved calculation
        let sum = 0;
        let nonZeroCount = 0;

        // Focus on the most relevant frequency range for voice
        const relevantRangeStart = Math.floor(bufferLength * 0.1);
        const relevantRangeEnd = Math.floor(bufferLength * 0.3);

        for (let i = relevantRangeStart; i < relevantRangeEnd; i++) {
          if (dataArray[i] > 0) {
            sum += dataArray[i];
            nonZeroCount++;
          }
        }

        const average = nonZeroCount > 0 ? sum / nonZeroCount : 0;

        // Update UI with requestAnimationFrame for smoother performance
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
          if (mountedRef.current) {
            setAudioLevel(average);
            if (average > peakLevel) {
              setPeakLevel(average);
            }
          }
        });

        // SPEECH DETECTION
        if (average > settings.speechThreshold) {
          if (!hasSpeechRef.current) {
            console.log(`Speech detected! Level: ${average.toFixed(1)}`);
            hasSpeechRef.current = true;
            silenceDetectedRef.current = false;
            silenceStartRef.current = null;
            setSilenceCountdown(null);
            setStatusMessage('Recording speech...');
          }
        }

        // SILENCE DETECTION - only check if we've detected speech previously
        if (hasSpeechRef.current) {
          const recordingTime = Date.now() - recordingStartTimeRef.current;

          // Only process silence after minimum recording time
          if (recordingTime > settings.minRecordingTime) {
            // Check if current level is below silence threshold
            if (average < settings.silenceThreshold) {
              // Start silence timer if not already started
              if (silenceStartRef.current === null) {
                silenceStartRef.current = Date.now();
                silenceDetectedRef.current = true;
                setStatusMessage('Silence detected after speech...');
              } else {
                // Calculate current silence duration
                const silenceDuration = Date.now() - silenceStartRef.current;

                // Show countdown to user
                const remainingTime = Math.ceil((settings.silenceDuration - silenceDuration) / 1000);
                setSilenceCountdown(remainingTime);

                // Check if silence duration threshold is reached
                if (silenceDuration > settings.silenceDuration) {
                  setStatusMessage('Silence threshold reached - auto-stopping');
                  clearInterval(silenceDetectorRef.current);

                  // Use setTimeout to ensure we don't call stop during interval execution
                  setTimeout(() => {
                    if (mountedRef.current && isRecording) {
                      stopRecording();
                    }
                  }, 0);
                } else {
                  setStatusMessage(`Silence detected (${remainingTime}s until auto-submit)...`);
                }
              }
            } else {
              // Audio level is above silence threshold, so reset silence detection
              if (silenceStartRef.current !== null) {
                silenceStartRef.current = null;
                silenceDetectedRef.current = false;
                setSilenceCountdown(null);
                setStatusMessage('Recording speech...');
              }
            }
          }
        }
      }, settings.checkInterval);

      // Set up media recorder event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording
      mediaRecorder.start(100);
      setIsRecording(true);
      setStatusMessage('Recording started! Waiting for speech...');

    } catch (error) {
      console.error("Error starting recording:", error);
      setStatusMessage(`Microphone error: ${error.message}`);
      setIsRecording(false);
      cleanup();
    }
  }, [cleanup, isProcessing, isRecording, settings]);

  // Stop recording function
  const stopRecording = useCallback(() => {
    setStatusMessage('Stopping recording...');
    setIsRecording(false);

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch (err) {
        console.error("Error stopping recorder:", err);
        setStatusMessage(`Error stopping: ${err.message}`);
      }

      // Clear silence detector
      if (silenceDetectorRef.current) {
        clearInterval(silenceDetectorRef.current);
        silenceDetectorRef.current = null;
      }

      // We keep hasSpeech true until the next recording starts
      setSilenceDetected(false);
      silenceDetectedRef.current = false;
    }
  }, []);

  // Get the recorded audio blob
  const getAudioBlob = useCallback(() => {
    if (audioChunksRef.current.length === 0) {
      return null;
    }

    return new Blob(audioChunksRef.current, { type: 'audio/webm' });
  }, []);

  // Reset the recording state
  const resetRecording = useCallback(() => {
    audioChunksRef.current = [];
    setAudioLevel(0);
    setPeakLevel(0);
    setAudioSamples([]);
    setSilenceCountdown(null);
    setHasSpeech(false);
    setSilenceDetected(false);
    hasSpeechRef.current = false;
    silenceDetectedRef.current = false;
    silenceStartRef.current = null;
  }, []);

  return {
    // State
    isRecording,
    hasSpeech,
    silenceDetected,
    audioLevel,
    peakLevel,
    statusMessage,
    silenceCountdown,
    audioSamples,
    isProcessing,

    // Methods
    startRecording,
    stopRecording,
    getAudioBlob,
    resetRecording,
    setIsProcessing,
    setStatusMessage,

    // Settings
    settings
  };
};

export default useVoiceRecorder;