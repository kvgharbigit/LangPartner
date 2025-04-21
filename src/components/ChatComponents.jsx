// ChatComponents.jsx
import React from 'react';

// Utility function to normalize text for comparison
const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,;:?!'"()[\]{}\-_@#$%^&*+=<>]/g, '')  // Remove all punctuation
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .trim();
};

// Function to find and highlight differences
const highlightDifferences = (original, suggestion) => {
  if (!original || !suggestion) return suggestion;

  // Normalize texts for comparison
  const normalizedOriginal = normalizeText(original);
  const normalizedSuggestion = normalizeText(suggestion);

  // If texts are identical after normalization, return the suggestion as-is
  if (normalizedOriginal === normalizedSuggestion) return suggestion;

  // Split suggestion into words, preserving original capitalization and punctuation
  const suggestionWords = suggestion.split(/\s+/);

  // Create a copy of suggestion words to modify
  const highlightedWords = suggestionWords.map((word, index) => {
    // Normalize current word for comparison, keeping original word for display
    const normalizedWord = normalizeText(word);

    // Check if this normalized word exists in the original text
    const isExactMatch = normalizeText(original)
      .split(/\s+/)
      .some(orig => normalizeText(orig) === normalizedWord);

    // If word is not in the original text, wrap it in <strong>
    return isExactMatch ? word : `<strong>${word}</strong>`;
  });

  // Convert back to a string, allowing HTML
  return highlightedWords.join(' ');
};

// Message Component
const Message = ({ message, originalUserMessage }) => {
  // Log the full message object for debugging
  console.log('Full Message Object:', message);
  console.log('Original User Message:', originalUserMessage);

  // Only apply normalization to the original user message
  const normalizedUserMessage = normalizeText(originalUserMessage || message.content);

  // Normalize grammar and native suggestions if they exist
  const normalizedNative = message.natural ? normalizeText(message.natural) : '';
  const normalizedCorrected = message.corrected ? normalizeText(message.corrected) : '';

  // Check if suggestions match the original user message
  const isIdenticalToNative = normalizedNative && normalizedUserMessage === normalizedNative;
  const isIdenticalToCorrected = normalizedCorrected && normalizedUserMessage === normalizedCorrected;

  // Highlight differences in suggestions
  const highlightedNative = isIdenticalToNative
    ? message.natural
    : (originalUserMessage
        ? highlightDifferences(originalUserMessage, message.natural)
        : message.natural);

  const highlightedCorrected = isIdenticalToCorrected
    ? message.corrected
    : (originalUserMessage
        ? highlightDifferences(originalUserMessage, message.corrected)
        : message.corrected);

  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        <p className="main-text">{message.content}</p>

        {message.corrected && (
          <div className={`message-annotation grammar-hint ${isIdenticalToCorrected ? 'identical' : ''}`}>
            <span className="annotation-label">Grammar:</span>
            <span
              className="annotation-text"
              dangerouslySetInnerHTML={{
                __html: highlightedCorrected
              }}
            >
            </span>
            {isIdenticalToCorrected && (
              <span className="native-match-icon">✅</span>
            )}
          </div>
        )}

        {message.natural && (
          <div className={`message-annotation native-hint ${isIdenticalToNative ? 'identical' : ''}`}>
            <span className="annotation-label">Native:</span>
            <span
              className="annotation-text"
              dangerouslySetInnerHTML={{
                __html: highlightedNative
              }}
            >
            </span>
            {isIdenticalToNative && (
              <span className="native-match-icon">✅</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Conversation Component
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
          {history.map((msg, index) => {
            // Find the original user message if this is an assistant message
            const originalUserMessage = msg.role === 'assistant'
              ? history[index - 1]?.content
              : null;

            return (
              <Message
                key={index}
                message={msg}
                originalUserMessage={originalUserMessage}
              />
            );
          })}

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