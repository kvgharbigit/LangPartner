// ChatComponents.jsx
// Purpose: Manages the Message component and Conversation display
// Key Features:
// - Displays conversation messages with main text and optional annotations
// - Handles empty state and loading indicators
// - Supports different message roles (user, assistant, system)

import React from 'react';

// Message Component
// Renders individual messages with main content and optional grammar/native suggestions
const Message = ({ message }) => {
  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        <p className="main-text">{message.content}</p>

        {message.corrected && (
          <div className="message-annotation grammar">
            <h4>Grammar</h4>
            <p>{message.corrected}</p>
          </div>
        )}

        {message.natural && (
          <div className="message-annotation native">
            <h4>Native</h4>
            <p>{message.natural}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Conversation Component
// Manages the entire conversation display, including empty state and loading
const Conversation = ({
  history,
  isLoading,
  nativeLanguage = 'en',
  targetLanguage = 'es'
}) => {
  return (
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
        </div>
      )}
    </div>
  );
};

export { Message, Conversation };