// ImprovedVoiceInput.jsx
import React, { useEffect } from 'react';
import useVoiceRecorder from './useVoiceRecorder';

const ImprovedVoiceInput = ({
  onAudioCaptured,
  disabled = false,
  silenceThreshold = 10,
  speechThreshold = 50,
  silenceDuration = 2000,
  minRecordingTime = 500,
  conversationId = null,
  tempo = 0.75,
  difficulty = "beginner",
  apiUrl = "http://localhost:8005"
}) => {
  // Use our custom hook with the provided settings
  const voiceRecorder = useVoiceRecorder({
    silenceThreshold,
    speechThreshold,
    silenceDuration,
    minRecordingTime
  });

  // Destructure values from the hook
  const {
    isRecording,
    hasSpeech,
    silenceDetected,
    statusMessage,
    startRecording,
    stopRecording,
    getAudioBlob,
    resetRecording,
    setIsProcessing,
    setStatusMessage,
    isProcessing
  } = voiceRecorder;

  // Handle recording stop
  useEffect(() => {
    if (!isRecording && hasSpeech && !isProcessing) {
      processCapturedAudio();
    }
  }, [isRecording, hasSpeech, isProcessing]);

  // Cleanup when disabled changes
  useEffect(() => {
    if (disabled && isRecording) {
      stopRecording();
    }
  }, [disabled, isRecording, stopRecording]);

  const handleVoiceButtonClick = (e) => {
    e.preventDefault();

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Process the audio
  const processCapturedAudio = async () => {
    const audioBlob = getAudioBlob();

    if (!audioBlob || audioBlob.size < 100) {
      setStatusMessage('No audio data recorded or recording too short');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Processing audio...');

    try {
      // If callback provided, let parent component handle audio
      if (onAudioCaptured) {
        await onAudioCaptured(audioBlob);
      } else {
        // Direct processing with server
        await processAudioWithServer(audioBlob);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      setStatusMessage(`Processing error: ${error.message}`);
    } finally {
      resetRecording();
      setIsProcessing(false);
    }
  };

  // Directly process audio with server if no callback is provided
  const processAudioWithServer = async (audioBlob) => {
    setStatusMessage('Sending to server...');

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

      const data = await response.json();
      setStatusMessage('Server processed the audio successfully');
      return data;

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

      {(isRecording || statusMessage) && (
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
          {statusMessage || (silenceDetected
            ? 'Silence detected - will send shortly...'
            : 'Recording... Speak in Spanish')}
        </div>
      )}
    </div>
  );
};

export default ImprovedVoiceInput;