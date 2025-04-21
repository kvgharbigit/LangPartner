// ImprovedSpanishTutor.jsx with better silence detection
import React, { useState, useEffect, useRef } from 'react';
import useVoiceRecorder from './useVoiceRecorder'; // Import our custom hook
import './SpanishTutor.css';
import ToggleSwitch from './ToggleSwitch';

// Base API URL - make sure this matches your backend
const API_URL = 'http://localhost:8028';

// Audio settings with improved values
const AUDIO_SETTINGS = {
  SILENCE_THRESHOLD: 40,
  SPEECH_THRESHOLD: 70,
  SILENCE_DURATION: 1500,
  MIN_RECORDING_TIME: 500,
  CHECK_INTERVAL: 50,
  FFT_SIZE: 128,
  SMOOTHING: 0.1
};

const SpanishTutor = () => {
  // Core state
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tempo, setTempo] = useState(0.75);
  const [isPlaying, setIsPlaying] = useState(false);
  const [difficulty, setDifficulty] = useState('beginner');
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [debugMode, setDebugMode] = useState(true);
  // Add this to the existing state declarations
  const [continuousConversation, setContinuousConversation] = useState(false);
  // Refs
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);

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
  // when silence has been detected for long enough after speech was recorded
  useEffect(() => {
      // Only trigger auto-submission if ALL these conditions are true:
      // 1. We are currently recording
      // 2. We have detected actual speech during this recording (not just background noise)
      // 3. We have detected silence after the speech
      // 4. The silence countdown has reached zero, indicating silence duration threshold was met
      if (isRecording && hasSpeech && silenceDetected && silenceCountdown === 0) {
        console.log("🔇 Auto-stopping recording due to silence detection countdown reaching zero");

        // Stop the recording, which will then trigger the handleAudioData function
        // through the existing useEffect hook that watches for [isRecording, hasSpeech, isProcessing]
        stopRecording();
      }
  }, [isRecording, hasSpeech, silenceDetected, silenceCountdown, stopRecording]);



  // This effect acts as a safety mechanism in case the countdown doesn't trigger properly
  // It sets a timer to force-stop recording after silence has been detected for the specified duration
  useEffect(() => {
      // Variable to store our timeout reference so we can clear it when needed
      let silenceTimer = null;

      // Only set up the timer if ALL these conditions are true:
      // 1. We are currently recording
      // 2. We have detected actual speech during this recording
      // 3. We have detected silence after the speech
      if (isRecording && hasSpeech && silenceDetected) {
        console.log("🔇 Setting up silence safety timer");

        // Create a timeout that will automatically stop the recording after the silence
        // has persisted for the duration specified in AUDIO_SETTINGS.SILENCE_DURATION
        silenceTimer = setTimeout(() => {
          console.log("🔇 Safety timeout triggered: stopping recording after extended silence");
          stopRecording();
        }, AUDIO_SETTINGS.SILENCE_DURATION + 500); // Add 500ms buffer to ensure the countdown had time to reach 0
      }

      // Clean up function to clear the timeout when the component unmounts
      // or when any of the dependencies change
      return () => {
        if (silenceTimer) {
          console.log("🔇 Clearing silence safety timer");
          clearTimeout(silenceTimer);
        }
      };
  }, [isRecording, hasSpeech, silenceDetected, stopRecording]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Text chat handler
  const handleSubmit = async (e) => {
    e.preventDefault();
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
          console.error("🔊 Audio playback error:", audioError);
        }
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);

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
      console.log(`📊 Audio blob size: ${(audioBlob.size / 1024).toFixed(1)}KB`);

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
      console.log("✅ Server processed audio successfully");

      // Update conversation
      setHistory(prev => {
        const filtered = prev.filter(msg => !msg.isTemporary);

        if (data.transcribed_text) {
          console.log(`🗣️ Transcribed: "${data.transcribed_text}"`);
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
          console.error("🔊 Audio playback error:", audioError);
        }
      }

    } catch (error) {
      console.error('❌ Error processing voice input:', error);
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

      // Add this block for continuous conversation
      if (continuousConversation && voiceInputEnabled) {
        // Ensure we're not already recording or processing
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

  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
  };

  const renderMessageContent = (msg) => {
    if (msg.role === 'user') {
      return <p>{msg.content}</p>;
    }

    return (
      <>
        <p>{msg.content}</p>
        {msg.corrected && (
          <div className="corrections">
            <h4>Corrected Grammar:</h4>
            <p>{msg.corrected}</p>
          </div>
        )}
        {msg.natural && (
          <div className="alternatives">
            <h4>Native Expression:</h4>
            <p>{msg.natural}</p>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="spanish-tutor">
      <div className="header">
        <h1>Spanish Tutor</h1>
        <div style={{ textAlign: 'right', marginBottom: '10px' }}>
          <button
            onClick={toggleDebugMode}
            style={{
              backgroundColor: debugMode ? '#ff5722' : '#f1f1f1',
              color: debugMode ? 'white' : '#333',
              border: 'none',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {debugMode ? 'Hide Debug Info' : 'Show Debug Info'}
          </button>
        </div>

        {/* Enhanced debug information panel */}
        {debugMode && (
          <div style={{
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '5px',
            padding: '10px',
            marginBottom: '15px'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>📊 Audio Debug Info</h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <div>
                <strong>Current Level:</strong> <span style={{ fontWeight: 'bold', color: '#2196f3' }}>{audioLevel.toFixed(1)}</span>
              </div>
              <div>
                <strong>Peak Level:</strong> <span style={{ fontWeight: 'bold', color: '#f44336' }}>{peakLevel.toFixed(1)}</span>
              </div>
              <div>
                <strong>Thresholds:</strong> Speech={AUDIO_SETTINGS.SPEECH_THRESHOLD}, Silence={AUDIO_SETTINGS.SILENCE_THRESHOLD}
              </div>
              <div style={{
                marginTop: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <strong>Continuous Conversation:</strong>
                <span style={{
                  color: continuousConversation ? '#4caf50' : '#f44336',
                  fontWeight: 'bold'
                }}>
                  {continuousConversation ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>

            {/* Audio level graph */}
            <div style={{
              height: '50px',
              backgroundColor: '#eee',
              marginBottom: '10px',
              position: 'relative',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              {/* Threshold lines */}
              <div style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${50 - (AUDIO_SETTINGS.SPEECH_THRESHOLD/40 * 50)}px`,
                borderTop: '1px dashed green',
                zIndex: 1
              }} />
              <div style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${50 - (AUDIO_SETTINGS.SILENCE_THRESHOLD/40 * 50)}px`,
                borderTop: '1px dashed orange',
                zIndex: 1
              }} />

              {/* Sample bars */}
              <div style={{ display: 'flex', height: '100%', alignItems: 'flex-end' }}>
                {audioSamples.map((sample, index) => (
                  <div
                    key={index}
                    style={{
                      width: `${100/50}%`,
                      height: `${Math.min(sample/40 * 100, 100)}%`,
                      backgroundColor: sample > AUDIO_SETTINGS.SPEECH_THRESHOLD
                        ? '#4caf50'
                        : sample > AUDIO_SETTINGS.SILENCE_THRESHOLD
                          ? '#ff9800'
                          : '#bdbdbd',
                      transition: 'height 0.1s'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* State indicators */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
              <div style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '4px',
                backgroundColor: isRecording ? '#e8f5e9' : '#f5f5f5',
                color: isRecording ? '#2e7d32' : '#757575',
                border: '1px solid #ddd',
                textAlign: 'center',
                fontWeight: 'bold'
              }}>
                Recording: {isRecording ? 'YES' : 'NO'}
              </div>
              <div style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '4px',
                backgroundColor: hasSpeech ? '#e8f5e9' : '#f5f5f5',
                color: hasSpeech ? '#2e7d32' : '#757575',
                border: '1px solid #ddd',
                textAlign: 'center',
                fontWeight: 'bold'
              }}>
                Speech: {hasSpeech ? 'YES' : 'NO'}
              </div>
              <div style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '4px',
                backgroundColor: silenceDetected ? '#fff3e0' : '#f5f5f5',
                color: silenceDetected ? '#e65100' : '#757575',
                border: '1px solid #ddd',
                textAlign: 'center',
                fontWeight: 'bold'
              }}>
                Silence: {silenceDetected ? 'YES' : 'NO'}
              </div>
            </div>

            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              <strong>Status:</strong> {statusMessage}
            </div>
          </div>
        )}

        {/* Control panel */}
        <div className="controls-container">
          <div className="tempo-control">
            <label htmlFor="tempo">Speech Speed:</label>
            <input
              type="range"
              id="tempo"
              min="0.5"
              max="1.5"
              step="0.1"
              value={tempo}
              onChange={(e) => setTempo(parseFloat(e.target.value))}
            />
            <span>{tempo < 0.8 ? 'Slow' : tempo > 1.2 ? 'Fast' : 'Normal'}</span>
          </div>

          <div className="difficulty-control">
            <label htmlFor="difficulty">Difficulty:</label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="difficulty-select"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div className="voice-input-toggle">
            <button
              onClick={toggleVoiceInput}
              disabled={isLoading}
              style={{
                backgroundColor: voiceInputEnabled ? '#128c7e' : '#f1f1f1',
                color: voiceInputEnabled ? 'white' : '#333',
                border: '1px solid #ddd',
                borderRadius: '5px',
                padding: '6px 12px',
              }}
            >
              <span>Voice Input:</span>
              <strong>{voiceInputEnabled ? 'ON' : 'OFF'}</strong>
            </button>
          </div>
          {voiceInputEnabled && (
          <div className="continuous-conversation-toggle" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginTop: '10px',
            width: '100%'
          }}>
            <ToggleSwitch
              isOn={continuousConversation}
              handleToggle={() => setContinuousConversation(!continuousConversation)}
              label="Continuous Conversation"
              disabled={!voiceInputEnabled}
            />
          </div>
        )}
        </div>
      </div>

      {/* Conversation area */}
      <div className="conversation">
        {history.length === 0 ? (
          <div className="empty-state">
            <p>¡Hola! Soy tu tutor de español. ¿Cómo puedo ayudarte hoy?</p>
            <p className="empty-state-subtitle">Start chatting in Spanish to practice!</p>
          </div>
        ) : (
          history.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}
            >
              {renderMessageContent(msg)}
            </div>
          ))
        )}

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

      {/* Input section */}
      <div className="input-container">
        {voiceInputEnabled ? (
          <div className="voice-input-controls">
            {/* Record button with visual feedback */}
            <button
              className={`voice-record-button ${isRecording ? 'recording' : ''}`}
              onClick={handleVoiceButtonClick}
              disabled={isLoading || isProcessing}
              type="button"
              style={{
                backgroundColor: isRecording ? '#e53935' : isProcessing ? '#FFA000' : '#128c7e',
                color: 'white',
                padding: '12px 20px',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                boxShadow: isRecording ? '0 0 0 rgba(229, 57, 53, 0.4)' : 'none',
                animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                transition: 'all 0.2s ease',
                width: '220px'
              }}
            >
              {isRecording
                ? 'Stop Recording'
                : isProcessing
                  ? 'Processing...'
                  : 'Start Recording'}
            </button>

            {/* Visual recording indicators */}
            {isRecording && (
              <div style={{
                marginTop: '15px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                {/* Main status indicator */}
                <div style={{
                  backgroundColor: silenceDetected ? '#fff3e0' : hasSpeech ? '#e8f5e9' : '#f5f5f5',
                  color: silenceDetected ? '#e65100' : hasSpeech ? '#2e7d32' : '#666',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontWeight: 'bold',
                  marginBottom: '10px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  border: `1px solid ${silenceDetected ? '#ffccbc' : hasSpeech ? '#c8e6c9' : '#e0e0e0'}`,
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '350px'
                }}>
                  {silenceDetected
                    ? silenceCountdown !== null
                      ? `Silence detected - auto-submitting in ${silenceCountdown}s`
                      : 'Silence detected - will auto-submit shortly...'
                    : hasSpeech
                      ? 'Recording... Keep speaking or pause for auto-submit'
                      : 'Waiting for speech...'}
                </div>

                {/* Real-time audio level meter */}
                <div style={{
                  width: '100%',
                  maxWidth: '350px',
                  height: '20px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginBottom: '10px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(audioLevel * 5, 100)}%`,
                    backgroundColor: audioLevel > AUDIO_SETTINGS.SPEECH_THRESHOLD
                      ? '#4caf50'
                      : audioLevel > AUDIO_SETTINGS.SILENCE_THRESHOLD
                        ? '#ff9800'
                        : '#bdbdbd',
                    transition: 'width 0.1s'
                  }} />
                </div>

                {/* Status flags */}
                <div style={{
                  display: 'flex',
                  gap: '15px',
                  justifyContent: 'center',
                  width: '100%'
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '10px 15px',
                    borderRadius: '10px',
                    backgroundColor: hasSpeech ? '#e8f5e9' : '#f5f5f5',
                    color: hasSpeech ? '#2e7d32' : '#9e9e9e',
                    opacity: hasSpeech ? 1 : 0.7,
                    border: `1px solid ${hasSpeech ? '#c8e6c9' : '#e0e0e0'}`,
                    flex: 1,
                    maxWidth: '150px',
                    boxShadow: hasSpeech ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.3s ease'
                  }}>
                    <span style={{ fontSize: '20px', marginBottom: '5px' }}>🎤</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                      Speech Detected
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '10px 15px',
                    borderRadius: '10px',
                    backgroundColor: silenceDetected ? '#fff3e0' : '#f5f5f5',
                    color: silenceDetected ? '#e65100' : '#9e9e9e',
                    opacity: silenceDetected ? 1 : 0.7,
                    border: `1px solid ${silenceDetected ? '#ffccbc' : '#e0e0e0'}`,
                    flex: 1,
                    maxWidth: '150px',
                    boxShadow: silenceDetected ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.3s ease'
                  }}>
                    <span style={{ fontSize: '20px', marginBottom: '5px' }}>🔇</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                      Silence Detected
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form className="message-input" onSubmit={handleSubmit}>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !message.trim()}>
              Enviar
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