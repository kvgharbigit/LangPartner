// VoiceInput.jsx
import React, { useState, useEffect, useRef } from 'react';

const VoiceInput = ({ 
  onAudioCaptured, 
  disabled = false,
  silenceThreshold = 10,
  silenceDuration = 2000,
  conversationId = null,
  tempo = 0.75,
  difficulty = "beginner",
  apiUrl = "http://localhost:8005"
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [silenceDetected, setSilenceDetected] = useState(false);
  const [status, setStatus] = useState('');

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const silenceDetectorRef = useRef(null);
  const audioStreamRef = useRef(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);

  // Cleanup when disabled changes
  useEffect(() => {
    if (disabled && isRecording) {
      stopRecording();
    }
  }, [disabled]);

  const cleanup = () => {
    if (silenceDetectorRef.current) {
      clearInterval(silenceDetectorRef.current);
      silenceDetectorRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    setSilenceDetected(false);
    audioChunksRef.current = [];
  };

  const startRecording = async () => {
    if (disabled || isRecording || isProcessing) return;

    try {
      setStatus('Requesting microphone access...');
      
      // Clean up any existing resources
      cleanup();
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      // Set up audio analyzer for silence detection
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Create media recorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      // Handle audio data
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Handle recording stop
      mediaRecorderRef.current.onstop = () => {
        if (!mountedRef.current) return;
        
        processCapturedAudio();
      };
      
      // Start recording
      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setStatus('Recording...');
      
      // Set up silence detection
      let silenceStart = null;
      
      silenceDetectorRef.current = setInterval(() => {
        if (!isRecording || !mountedRef.current) {
          clearInterval(silenceDetectorRef.current);
          return;
        }
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        
        if (average < silenceThreshold) {
          if (!silenceStart) {
            silenceStart = Date.now();
            setSilenceDetected(true);
            setStatus('Silence detected...');
          } else if (Date.now() - silenceStart > silenceDuration) {
            setStatus('Long silence - stopping');
            clearInterval(silenceDetectorRef.current);
            stopRecording();
          }
        } else {
          silenceStart = null;
          setSilenceDetected(false);
          setStatus('Recording in progress');
        }
      }, 100);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setStatus(`Error: ${error.message}`);
      cleanup();
    }
  };

  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;
    
    setStatus('Stopping recording...');
    
    try {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear silence detector
      if (silenceDetectorRef.current) {
        clearInterval(silenceDetectorRef.current);
        silenceDetectorRef.current = null;
      }
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      setStatus(`Error stopping: ${error.message}`);
      setIsRecording(false);
      cleanup();
    }
  };

  const processCapturedAudio = async () => {
    if (audioChunksRef.current.length === 0) {
      setStatus('No audio recorded');
      return;
    }
    
    setIsProcessing(true);
    setStatus('Processing audio...');
    
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // If callback provided, send the processed audio
      if (onAudioCaptured) {
        await onAudioCaptured(audioBlob);
      }
      
    } catch (error) {
      console.error('Error processing audio:', error);
      setStatus(`Processing error: ${error.message}`);
    } finally {
      cleanup();
      setIsProcessing(false);
      setStatus('');
    }
  };

  const handleVoiceButtonClick = (e) => {
    e.preventDefault();
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Directly process audio with server
  const processAudioWithServer = async (audioBlob) => {
    setStatus('Sending to server...');
    
    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'recording.webm');
    
    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }
    
    formData.append('tempo', tempo);
    formData.append('difficulty', difficulty);
    
    try {
      const response = await fetch(`${apiUrl}/voice-input`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      return await response.json();
      
    } catch (error) {
      console.error('Server processing error:', error);
      throw error;
    }
  };

  return (
    <div className="voice-input-container">
      <button
        className={`voice-record-button ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
        onClick={handleVoiceButtonClick}
        disabled={disabled || isProcessing}
        style={{
          backgroundColor: isRecording ? '#e53935' : isProcessing ? '#FFA000' : '#128c7e',
          color: 'white',
          border: 'none',
          borderRadius: '20px',
          padding: '10px 20px',
          cursor: disabled || isProcessing ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '10px auto',
          minWidth: '200px',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.3s ease'
        }}
      >
        {isRecording 
          ? 'Stop Recording' 
          : isProcessing 
            ? 'Processing...' 
            : 'Start Recording'}
      </button>
      
      {(isRecording || status) && (
        <div 
          className={`status-indicator ${silenceDetected ? 'silence-detected' : ''}`}
          style={{
            padding: '8px 16px',
            borderRadius: '5px',
            textAlign: 'center',
            fontWeight: silenceDetected ? 'bold' : 'normal',
            backgroundColor: silenceDetected ? '#ffe082' : isProcessing ? '#fff3e0' : '#f1f1f1',
            color: silenceDetected ? '#ff6f00' : isProcessing ? '#e65100' : '#555',
            margin: '5px auto',
            maxWidth: '80%',
            transition: 'all 0.3s ease'
          }}
        >
          {status || (silenceDetected 
            ? 'Silence detected - will send shortly...' 
            : 'Recording... Speak in Spanish')}
        </div>
      )}
    </div>
  );
};

export default VoiceInput;