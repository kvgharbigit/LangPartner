// SpanishTutor.jsx with Button Toggle
import React, { useState, useEffect, useRef } from 'react';
import './SpanishTutor.css';

// Make sure this port matches your actual backend API port
const API_URL = 'http://localhost:8023';

const SpanishTutor = () => {
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tempo, setTempo] = useState(0.75);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [difficulty, setDifficulty] = useState('beginner');
  const [silenceDetected, setSilenceDetected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');  // Status message for debugging

  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const silenceDetectorRef = useRef(null);
  const audioStreamRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [history]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      stopMediaTracks();
      clearSilenceDetector();
    };
  }, []);

  const clearSilenceDetector = () => {
    if (silenceDetectorRef.current) {
      clearInterval(silenceDetectorRef.current);
      silenceDetectorRef.current = null;
    }
  };

  const stopMediaTracks = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
      setStatusMessage('Microphone released');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
    setMessage(''); // Clear input field immediately

    try {
      console.log("Sending request to:", `${API_URL}/chat`);
      console.log("Request payload:", {
        message,
        conversation_id: conversationId,
        tempo,
        difficulty,
      });

      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversation_id: conversationId,
          tempo,
          difficulty,
        }),
      });

      if (!response.ok) {
        // Get the error details if possible
        const errorText = await response.text();
        console.error("Server error response:", errorText);
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Received response:", data);

      // Update conversation ID if new
      if (!conversationId) {
        setConversationId(data.conversation_id);
      }

      // Update history with full conversation history
      setHistory(data.history);

      // Play audio response
      if (data.audio_url) {
        // Ensure proper URL construction
        const audioUrl = `${API_URL}${data.audio_url.startsWith('/') ? data.audio_url : '/' + data.audio_url}`;
        console.log("Playing audio from:", audioUrl);

        audioRef.current.src = audioUrl;

        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (audioError) {
          console.error("Audio playback error:", audioError);
          alert("Could not play audio response. Please check console for details.");
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);

      // Add an error message to the conversation
      setHistory(prev => [
        ...prev,
        {
          role: 'system',
          content: `Error: ${error.message}. Please try again or refresh the page.`,
          timestamp: new Date().toISOString()
        }
      ]);

    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  // Voice recording functions with silence detection
  const startRecording = async () => {
    try {
      // Clear any existing audio chunks
      audioChunksRef.current = [];
      setStatusMessage('Requesting microphone permissions...');

      // First ensure we've cleaned up any previous streams
      stopMediaTracks();
      clearSilenceDetector();

      // Request microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      setStatusMessage('Microphone access granted. Starting recording...');

      // Setup audio analysis for silence detection
      const audioContext = new AudioContext();
      const audioSource = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      audioSource.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Variables for silence detection
      let silenceStart = null;
      const SILENCE_THRESHOLD = 10; // Adjust as needed for sensitivity
      const SILENCE_DURATION = 2000; // 2 seconds of silence before auto-sending

      // Function to check audio levels
      silenceDetectorRef.current = setInterval(() => {
        if (!isRecording) {
          clearInterval(silenceDetectorRef.current);
          setSilenceDetected(false);
          return;
        }

        analyser.getByteFrequencyData(dataArray);

        // Calculate audio level (average of frequency data)
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

        // If below threshold, it's silence
        if (average < SILENCE_THRESHOLD) {
          if (!silenceStart) {
            silenceStart = Date.now();
            setSilenceDetected(true);
            setStatusMessage('Silence detected...');
          } else if (Date.now() - silenceStart > SILENCE_DURATION) {
            // If silence for specified duration, stop recording
            setStatusMessage('Long silence detected - auto-stopping');
            clearInterval(silenceDetectorRef.current);
            stopRecording();
          }
        } else {
          // Reset silence timer if sound detected
          silenceStart = null;
          setSilenceDetected(false);
        }
      }, 100); // Check every 100ms

      // Create and configure MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        clearInterval(silenceDetectorRef.current);
        setStatusMessage('Recording stopped, processing data...');
        handleAudioData();
      };

      // Start recording
      mediaRecorder.start(100); // Collect data in 100ms chunks
      setIsRecording(true);
      setStatusMessage('Recording started!');
      console.log("Recording started with silence detection...");
    } catch (error) {
      console.error("Error starting recording:", error);
      setStatusMessage(`Microphone error: ${error.message}`);
      alert("Could not access microphone. Please ensure microphone permissions are enabled.");
      setVoiceInputEnabled(false);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setStatusMessage('Stopping recording...');
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
        setStatusMessage('Recording stopped correctly.');
        console.log("Recording stopped correctly.");
      } catch (err) {
        console.error("Error stopping recording:", err);
        setStatusMessage(`Error stopping: ${err.message}`);
      }

      setIsRecording(false);
      setSilenceDetected(false);
    } else {
      setStatusMessage('No active recorder to stop');
    }
  };

  const handleAudioData = async () => {
    if (audioChunksRef.current.length === 0) {
      setStatusMessage('No audio data recorded');
      console.log("No audio data recorded");
      return;
    }

    setIsLoading(true);
    setStatusMessage('Processing audio data...');

    try {
      // Create a blob from the audio chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

      // Create a temporary loading message in the UI
      const tempMessage = {
        role: 'user',
        content: "🎤 Processing voice...",
        timestamp: new Date().toISOString(),
        isTemporary: true
      };

      setHistory(prev => [...prev, tempMessage]);

      // Create form data to send to server
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.webm');
      if (conversationId) {
        formData.append('conversation_id', conversationId);
      }
      formData.append('tempo', tempo);
      formData.append('difficulty', difficulty);

      setStatusMessage('Sending audio to server...');
      // Send to server
      const response = await fetch(`${API_URL}/voice-input`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error response:", errorText);
        setStatusMessage(`Server error: ${response.status}`);
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      setStatusMessage('Received response from server');
      console.log("Received voice input response:", data);

      // Remove temporary message and add transcribed text
      setHistory(prev => {
        // Filter out the temporary message
        const filtered = prev.filter(msg => !msg.isTemporary);

        // Add the transcribed message if it exists
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

      // Update conversation ID if new
      if (!conversationId && data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      // Play audio response
      if (data.audio_url) {
        const audioUrl = `${API_URL}${data.audio_url.startsWith('/') ? data.audio_url : '/' + data.audio_url}`;
        setStatusMessage('Playing audio response...');
        console.log("Playing audio from:", audioUrl);

        audioRef.current.src = audioUrl;

        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (audioError) {
          console.error("Audio playback error:", audioError);
          setStatusMessage(`Audio playback error: ${audioError.message}`);
          alert("Could not play audio response. Please check console for details.");
        }
      }

    } catch (error) {
      console.error('Error processing voice input:', error);
      setStatusMessage(`Processing error: ${error.message}`);

      // Add an error message to the conversation
      setHistory(prev => {
        // Filter out the temporary message
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
    }
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

  // Handle toggle using a simple button
  const toggleVoiceInput = () => {
    // Force stop recording if active
    if (isRecording) {
      stopRecording();
    }

    // Clean up resources if turning off
    if (voiceInputEnabled) {
      stopMediaTracks();
      clearSilenceDetector();
    }

    // Toggle the state
    setVoiceInputEnabled(!voiceInputEnabled);
    setStatusMessage(`Voice input ${!voiceInputEnabled ? 'enabled' : 'disabled'}`);
    console.log(`Voice input toggled: ${!voiceInputEnabled}`);
  };

  // Simplified voice button handler
  const handleVoiceButtonClick = (e) => {
    e.preventDefault(); // Prevent any default form behavior
    console.log("Voice button clicked, recording state:", isRecording);

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="spanish-tutor">
      <div className="header">
        <h1>Spanish Tutor</h1>

        {/* Status message display */}
        {statusMessage && (
          <div style={{
            backgroundColor: '#f0f0f0',
            padding: '8px',
            margin: '8px 0',
            borderRadius: '5px',
            fontSize: '14px',
            color: '#333'
          }}>
            <strong>Status:</strong> {statusMessage}
            <div style={{ fontSize: '12px', marginTop: '4px', color: '#666' }}>
              Voice Input: {voiceInputEnabled ? 'ON' : 'OFF'} |
              Recording: {isRecording ? 'YES' : 'NO'}
            </div>
          </div>
        )}

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

          {/* Replace the toggle switch with a simple button */}
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
                fontSize: '14px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>Voice Input:</span>
              <strong>{voiceInputEnabled ? 'ON' : 'OFF'}</strong>
            </button>
          </div>
        </div>
      </div>

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

      <div className="input-container">
        {voiceInputEnabled ? (
          <div className="voice-input-controls">
            <button
              className={`voice-record-button ${isRecording ? 'recording' : ''}`}
              onClick={handleVoiceButtonClick}
              disabled={isLoading}
              type="button"
              style={{
                // Additional inline styles to ensure the button is clearly visible
                backgroundColor: isRecording ? '#e53935' : '#128c7e',
                padding: '10px 20px',
                margin: '10px auto',
                display: 'block',
                fontSize: '16px',
                minWidth: '200px'
              }}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
            {isRecording && (
              <div className={`recording-indicator ${silenceDetected ? 'silence-detected' : ''}`}
                style={{
                  // Ensure the indicator is clearly visible
                  padding: '8px 16px',
                  borderRadius: '5px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  backgroundColor: silenceDetected ? '#ffe082' : '#f1f1f1',
                  color: silenceDetected ? '#ff6f00' : '#555'
                }}
              >
                {silenceDetected
                  ? 'Silence detected - will send shortly...'
                  : 'Recording... Speak in Spanish'}
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

      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        controls={false}
      />

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