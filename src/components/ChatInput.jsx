// ChatInput.jsx
// Purpose: Provides a text input interface for sending messages
// Key Features:
// - Supports different languages for placeholder text
// - Handles message submission
// - Disables send button when input is empty or loading

import React, { useState } from 'react';

const ChatInput = ({
  onSubmit,
  disabled = false,
  targetLanguage = 'es'
}) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!message.trim() || disabled) return;

    onSubmit(message);
    setMessage('');
  };

  return (
    <form className="text-input-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={targetLanguage === 'es' ? "Escribe tu mensaje aquí..." : "Type your message here..."}
        disabled={disabled}
        className="text-input"
      />
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        className="send-button"
      >
        {targetLanguage === 'es' ? 'Enviar' : 'Send'}
      </button>
    </form>
  );
};

export default ChatInput;