// SpanishTutor.jsx
import React, { useState, useEffect, useRef } from 'react';
import useVoiceRecorder from './useVoiceRecorder';
import { Conversation } from './ChatComponents';
import ChatInput from './ChatInput';
import TutorHeader from './TutorHeader';
import './SpanishTutor.css';

//const API_URL = ' https://language-tutor-984417336702.asia-east1.run.app';
const API_URL = 'http://127.0.0.1:8004';

// Audio settings
const AUDIO_SETTINGS = {
  SILENCE_THRESHOLD: 40,
  SPEECH_THRESHOLD: 70,
  SILENCE_DURATION: 1500,
  MIN_RECORDING_TIME: 500,
  CHECK_INTERVAL: 50,
  FFT_SIZE: 128,
  SMOOTHING: 0.1
};

// Audio Visualizer Component
const AudioVisualizer = ({ audioSamples, speechThreshold, silenceThreshold }) => {
  return (
    <div className="audio-visualizer">
      <div className="threshold-line speech" style={{ bottom: `${speechThreshold * 100 / 120}%` }}></div>
      <div className="threshold-line silence" style={{ bottom: `${silenceThreshold * 100 / 120}%` }}></div>
      <div className="sample-bars">
        {audioSamples.length === 0 ? (
          Array.from({ length: 50 }).map((_, index) => (
            <div
              key={index}
              className="sample-bar"
              style={{ height: '0%' }}
            />
          ))
        ) : (
          audioSamples.map((sample, index) => (
            <div
              key={index}
              className={`sample-bar ${sample > speechThreshold ? 'speech' : sample > silenceThreshold ? 'medium' : 'low'}`}
              style={{ height: `${Math.min(sample * 100 / 120, 100)}%` }}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Status Pill Component
const StatusPill = ({ active, icon, label }) => {
  return (
    <div className={`status-pill ${active ? 'active' : ''}`}>
      <div className="status-icon">{icon}</div>
      <div className="status-label">{label}</div>
    </div>
  );
};

const SpanishTutor = ({
  nativeLanguage = 'en',
  targetLanguage = 'es',
  initialDifficulty = 'beginner',
  learningObjective = ''
}) => {
  // Core state
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tempo, setTempo] = useState(0.75);
  const [isPlaying, setIsPlaying] = useState(false);
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [continuousConversation, setContinuousConversation] = useState(false);

  // Refs
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Get language display info
  const getLanguageInfo = (code) => {
    const languages = {
      'en': { name: 'English', flag: '🇬🇧' },
      'es': { name: 'Spanish', flag: '🇪🇸' }
    };
    return languages[code] || { name: 'Unknown', flag: '🏳️' };
  };

  const targetInfo = getLanguageInfo(targetLanguage);

  // Use our custom voice recorder hook
  const voiceRecorder = useVoiceRecorder({
    silenceThreshold: AUDIO_SETTINGS.SILENCE_THRESHOLD,
    speechThreshold: AUDIO_SETTINGS.SPEECH_THRESHOLD,
    silenceDuration: AUDIO_SETTINGS.SILENCE_DURATION,
    minRecordingTime: AUDIO_SETTINGS.MIN_RECORDING_TIME,
    checkInterval: AUDIO_SETTINGS.CHECK_INTERVAL,
    fftSize: AUDIO_SETTINGS.FFT_SIZE,
    smoothing: AUDIO_SETTINGS.SMOOTHING
  });

  // Destructure values from the hook
  const {
    isRecording,
    hasSpeech,
    silenceDetected,
    audioLevel,
    peakLevel,
    statusMessage,
    silenceCountdown,
    audioSamples,
    isProcessing,
    startRecording,
    stopRecording,
    getAudioBlob,
    resetRecording,
    setIsProcessing,
    setStatusMessage
  } = voiceRecorder;

  // Handle media recorder stop event
  useEffect(() => {
    if (!isRecording && hasSpeech && !isProcessing) {
      handleAudioData();
    }
  }, [isRecording, hasSpeech, isProcessing]);

  // This effect watches for the end of silence countdown and triggers auto-submission
  useEffect(() => {
    if (isRecording && hasSpeech && silenceDetected && silenceCountdown === 0) {
      stopRecording();
    }
  }, [isRecording, hasSpeech, silenceDetected, silenceCountdown, stopRecording]);

  // Silence safety mechanism
  useEffect(() => {
    let silenceTimer = null;

    if (isRecording && hasSpeech && silenceDetected) {
      silenceTimer = setTimeout(() => {
        stopRecording();
      }, AUDIO_SETTINGS.SILENCE_DURATION + 500);
    }

    return () => {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
    };
  }, [isRecording, hasSpeech, silenceDetected, stopRecording]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Welcome message when the component mounts
  useEffect(() => {
    if (history.length === 0) {
      let welcomeMessage = {
        role: 'assistant',
        content: targetLanguage === 'es'
          ? '¡Hola! Soy tu tutor de español. ¿Cómo puedo ayudarte hoy?'
          : 'Hello! I\'m your English tutor. How can I help you today?',
        timestamp: new Date().toISOString()
      };

      // Add learning objective to welcome message if provided
      if (learningObjective) {
        welcomeMessage = {
          ...welcomeMessage,
          content: targetLanguage === 'es'
            ? `¡Hola! Veo que quieres practicar: "${learningObjective}". ¡Empecemos!`
            : `Hello! I see you want to practice: "${learningObjective}". Let's begin!`
        };
      }

      setHistory([welcomeMessage]);
    }
  }, [targetLanguage, learningObjective]);

  // Text chat handler
  const handleSubmit = async (inputMessage) => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setHistory(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          conversation_id: conversationId,
          tempo,
          difficulty,
          native_language: nativeLanguage,
          target_language: targetLanguage,
          learning_objective: learningObjective // Include learning objective in request
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();

      if (!conversationId) {
        setConversationId(data.conversation_id);
      }

      setHistory(data.history);

      if (data.audio_url) {
        const audioUrl = `${API_URL}${data.audio_url.startsWith('/') ? data.audio_url : '/' + data.audio_url}`;
        audioRef.current.src = audioUrl;

        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (audioError) {
          console.error("Audio playback error:", audioError);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setHistory(prev => [
        ...prev,
        {
          role: 'system',
          content: `Error: ${error.message}. Please try again.`,
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Process recorded audio
  const handleAudioData = async () => {
    const audioBlob = getAudioBlob();

    if (!audioBlob || audioBlob.size < 100) {
      setStatusMessage('No audio data recorded or recording too short');
      return;
    }

    setIsLoading(true);
    setIsProcessing(true);
    setStatusMessage('Processing audio data...');

    try {
      // Show temporary message
      const tempMessage = {
        role: 'user',
        content: "🎤 Processing voice...",
        timestamp: new Date().toISOString(),
        isTemporary: true
      };
      setHistory(prev => [...prev, tempMessage]);

      // Create form data
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.webm');
      if (conversationId) {
        formData.append('conversation_id', conversationId);
      }
      formData.append('tempo', tempo);
      formData.append('difficulty', difficulty);
      formData.append('native_language', nativeLanguage);
      formData.append('target_language', targetLanguage);
      formData.append('learning_objective', learningObjective); // Include learning objective

      setStatusMessage('Sending audio to server...');
      const response = await fetch(`${API_URL}/voice-input`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      setStatusMessage('Received response from server');

      // Update conversation
      setHistory(prev => {
        const filtered = prev.filter(msg => !msg.isTemporary);

        if (data.transcribed_text) {
          return [
            ...filtered,
            {
              role: 'user',
              content: data.transcribed_text,
              timestamp: new Date().toISOString()
            },
            {
              role: 'assistant',
              content: data.reply,
              corrected: data.corrected,
              natural: data.natural,
              timestamp: new Date().toISOString()
            }
          ];
        }
        return filtered;
      });

      if (!conversationId && data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      // Play audio
      if (data.audio_url) {
        const audioUrl = `${API_URL}${data.audio_url.startsWith('/') ? data.audio_url : '/' + data.audio_url}`;
        setStatusMessage('Playing audio response...');

        audioRef.current.src = audioUrl;
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (audioError) {
          console.error("Audio playback error:", audioError);
        }
      }

    } catch (error) {
      console.error('Error processing voice input:', error);
      setStatusMessage(`Processing error: ${error.message}`);

      setHistory(prev => {
        const filtered = prev.filter(msg => !msg.isTemporary);
        return [
          ...filtered,
          {
            role: 'system',
            content: `Error: ${error.message}. Please try again.`,
            timestamp: new Date().toISOString()
          }
        ];
      });
    } finally {
      setIsLoading(false);
      setIsProcessing(false);
      resetRecording();
    }
  };

  // UI Handlers
  const handleAudioEnded = () => {
    setIsPlaying(false);

    if (continuousConversation && voiceInputEnabled) {
      if (!isRecording && !isProcessing) {
        startRecording();
      }
    }
  };

  const toggleVoiceInput = () => {
    if (isRecording) {
      stopRecording();
    }
    setVoiceInputEnabled(!voiceInputEnabled);
    setStatusMessage(`Voice input ${!voiceInputEnabled ? 'enabled' : 'disabled'}`);
  };

  const handleVoiceButtonClick = (e) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="tutor-container">
      <TutorHeader
        targetLanguage={targetLanguage}
        targetInfo={targetInfo}
        tempo={tempo}
        setTempo={setTempo}
        voiceInputEnabled={voiceInputEnabled}
        toggleVoiceInput={toggleVoiceInput}
        continuousConversation={continuousConversation}
        setContinuousConversation={setContinuousConversation}
        debugMode={debugMode}
        setDebugMode={setDebugMode}
      />

      {debugMode && (
        <div className="debug-panel">
          <div className="debug-info">
            <div className="debug-metrics">
              <div className="metric">
                <span className="metric-label">Level</span>
                <span className="metric-value">{audioLevel.toFixed(1)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Peak</span>
                <span className="metric-value">{peakLevel.toFixed(1)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Status</span>
                <span className="metric-value status">{statusMessage}</span>
              </div>
            </div>

            <div className="debug-status-pills">
              <StatusPill
                active={isRecording}
                icon="🎙️"
                label="Recording"
              />
              <StatusPill
                active={hasSpeech}
                icon="🗣️"
                label="Speech"
              />
              <StatusPill
                active={silenceDetected}
                icon="🔇"
                label="Silence"
              />
              {silenceDetected && silenceCountdown !== null && (
                <div className="countdown-timer">{silenceCountdown}s</div>
              )}
            </div>

            <AudioVisualizer
              audioSamples={audioSamples}
              speechThreshold={AUDIO_SETTINGS.SPEECH_THRESHOLD}
              silenceThreshold={AUDIO_SETTINGS.SILENCE_THRESHOLD}
            />
          </div>
        </div>
      )}

      <Conversation
        history={history}
        isLoading={isLoading}
        nativeLanguage={nativeLanguage}
        targetLanguage={targetLanguage}
      />

      <div className="input-container">
        {voiceInputEnabled ? (
          <div className="voice-input-controls">
            <button
              className={`voice-button ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
              onClick={handleVoiceButtonClick}
              disabled={isProcessing}
            >
              {isRecording ? (
                <>
                  <span className="pulse"></span>
                  <span className="mic-icon">🎙️</span>
                  <span className="button-text">Stop Recording</span>
                </>
              ) : isProcessing ? (
                <>
                  <span className="processing-icon">⏳</span>
                  <span className="button-text">Processing...</span>
                </>
              ) : (
                <>
                  <span className="mic-icon">🎙️</span>
                  <span className="button-text">Start Recording</span>
                </>
              )}
            </button>

            {isRecording && (
              <div className={`recording-status ${silenceDetected ? 'silence' : hasSpeech ? 'speech' : 'waiting'}`}>
                {silenceDetected
                  ? (
                    <>
                      <span className="status-icon">🔇</span>
                      <span>Silence detected - will auto-submit {silenceCountdown ? `in ${silenceCountdown}s` : 'shortly'}</span>
                    </>
                  )
                  : hasSpeech
                    ? (
                      <>
                        <span className="status-icon">🗣️</span>
                        <span>Recording your speech... Pause to auto-submit</span>
                      </>
                    )
                    : (
                      <>
                        <span className="status-icon">👂</span>
                        <span>Waiting for speech...</span>
                      </>
                    )
                }
              </div>
            )}
          </div>
        ) : (
          <ChatInput
            onSubmit={handleSubmit}
            disabled={isLoading}
            targetLanguage={targetLanguage}
          />
        )}
      </div>

      {/* Hidden audio player */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        controls={false}
      />

      {/* Audio controls */}
      {isPlaying && (
        <div className="audio-controls">
          <button onClick={() => audioRef.current.pause()}>
            Pause Audio
          </button>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default SpanishTutor;