// Complete Modified SpanishTutor.jsx
import React, { useState, useEffect, useRef } from 'react';
import useVoiceRecorder from './useVoiceRecorder';
import './SpanishTutor.css';

const API_URL = 'http://localhost:8036';

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

// Toggle Switch Component
const ToggleSwitch = ({ isOn, handleToggle, label = '', disabled = false }) => {
  return (
    <div className="toggle-switch-component">
      <label className="label">{label}</label>
      <label className="switch">
        <input
          type="checkbox"
          checked={isOn}
          onChange={handleToggle}
          disabled={disabled}
        />
        <span className="slider"></span>
      </label>
    </div>
  );
};

// Audio Visualizer Component
const AudioVisualizer = ({ audioSamples, speechThreshold, silenceThreshold }) => {
  return (
    <div className="audio-visualizer">
      <div className="threshold-line speech" style={{ bottom: `${speechThreshold * 100 / 120}%` }}></div>
      <div className="threshold-line silence" style={{ bottom: `${silenceThreshold * 100 / 120}%` }}></div>
      <div className="sample-bars">
        {audioSamples.length === 0 ? (
          // Display placeholder bars when no samples are available
          Array.from({ length: 50 }).map((_, index) => (
            <div
              key={index}
              className="sample-bar"
              style={{ height: '0%' }}
            />
          ))
        ) : (
          // Display actual audio sample bars
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

// Message Component
const Message = ({ message }) => {
  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        <p>{message.content}</p>
        {message.corrected && (
          <div className="corrections">
            <h4>Corrected Grammar:</h4>
            <p>{message.corrected}</p>
          </div>
        )}
        {message.natural && (
          <div className="alternatives">
            <h4>Native Expression:</h4>
            <p>{message.natural}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const SpanishTutor = ({ nativeLanguage = 'en', targetLanguage = 'es' }) => {
  // Core state
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tempo, setTempo] = useState(0.75);
  const [isPlaying, setIsPlaying] = useState(false);
  const [difficulty, setDifficulty] = useState('beginner');
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

  const nativeInfo = getLanguageInfo(nativeLanguage);
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
      // This means recording was stopped after detecting speech
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
    // Only show welcome message if this is a new conversation
    if (history.length === 0) {
      const welcomeMessage = {
        role: 'assistant',
        content: targetLanguage === 'es'
          ? '¡Hola! Soy tu tutor de español. ¿Cómo puedo ayudarte hoy?'
          : 'Hello! I\'m your English tutor. How can I help you today?',
        timestamp: new Date().toISOString()
      };

      setHistory([welcomeMessage]);
    }
  }, [targetLanguage]);

  // Text chat handler
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!message.trim() || isLoading) return;

    // Add user message to UI immediately
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setHistory(prev => [...prev, userMessage]);
    setIsLoading(true);
    setMessage('');

    try {
      // Send chat request to API
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversation_id: conversationId,
          tempo,
          difficulty,
          native_language: nativeLanguage,
          target_language: targetLanguage,
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

      // Create form data for API
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.webm');
      if (conversationId) {
        formData.append('conversation_id', conversationId);
      }
      formData.append('tempo', tempo);
      formData.append('difficulty', difficulty);
      formData.append('native_language', nativeLanguage);
      formData.append('target_language', targetLanguage);

      // Send to server
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

    // Start recording again if continuous conversation is enabled
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
      <div className="tutor-header">
        <div className="tutor-logo">
          <span className="flag">{targetInfo.flag}</span>
          <h1>{targetInfo.name} Tutor</h1>
        </div>

        <div className="header-controls">
          <div className="control-group">
            <label>Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="select-control"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div className="control-group">
            <label>Speech Speed</label>
            <div className="slider-container">
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={tempo}
                onChange={(e) => setTempo(parseFloat(e.target.value))}
                className="slider"
              />
              <span className="slider-value">
                {tempo < 0.8 ? 'Slow' : tempo > 1.2 ? 'Fast' : 'Normal'}
              </span>
            </div>
          </div>

          <div className="control-group voice-controls">
            <ToggleSwitch
              isOn={voiceInputEnabled}
              handleToggle={toggleVoiceInput}
              label="Voice Input"
            />

            {voiceInputEnabled && (
              <ToggleSwitch
                isOn={continuousConversation}
                handleToggle={() => setContinuousConversation(!continuousConversation)}
                label="Continuous Mode"
                disabled={!voiceInputEnabled}
              />
            )}
          </div>

          <button
            className="debug-toggle"
            onClick={() => setDebugMode(!debugMode)}
          >
            {debugMode ? 'Hide Debug' : 'Show Debug'}
          </button>
        </div>
      </div>

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

      <div className="conversation-container">
        {history.length === 0 ? (
          <div className="empty-state">
            <div className="welcome-icon">👋</div>
            <h2>{targetLanguage === 'es' ? '¡Hola! Soy tu tutor de español.' : 'Hello! I am your English tutor.'}</h2>
            <p>{targetLanguage === 'es'
              ? 'Start practicing your Spanish conversation skills!'
              : 'Start practicing your English conversation skills!'}
            </p>
          </div>
        ) : (
          <div className="messages">
            {history.map((msg, index) => (
              <Message key={index} message={msg} />
            ))}

            {isLoading && (
              <div className="message assistant loading">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

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
          <form className="text-input-form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={targetLanguage === 'es' ? "Escribe tu mensaje aquí..." : "Type your message here..."}
              disabled={isLoading}
              className="text-input"
            />
            <button
              type="submit"
              disabled={isLoading || !message.trim()}
              className="send-button"
            >
              {targetLanguage === 'es' ? 'Enviar' : 'Send'}
            </button>
          </form>
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
    </div>
  );
};

export default SpanishTutor;