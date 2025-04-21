// TutorHeader.jsx with improved toggle buttons
import React, { useState } from 'react';

// Improved Toggle Switch Component
const ToggleSwitch = ({ isOn, handleToggle, label = '', disabled = false }) => {
  return (
    <div className="toggle-switch-component">
      {label && <label className="label">{label}</label>}
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

const TutorHeader = ({
  targetLanguage,
  targetInfo,
  tempo,
  setTempo,
  voiceInputEnabled,
  toggleVoiceInput,
  continuousConversation,
  setContinuousConversation,
  debugMode,
  setDebugMode
}) => {
  const [showControls, setShowControls] = useState(false);

  return (
    <div className="tutor-header">
      <div className="tutor-logo">
        <span className="flag">{targetInfo.flag}</span>
        <h1>{targetInfo.name} Tutor</h1>
      </div>

      <div className="header-controls">
        {showControls ? (
          <>
            <div className="control-group">
              <label>Speed:</label>
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
                  {tempo.toFixed(1)}x
                </span>
              </div>
            </div>

            <div className="control-group">
              <ToggleSwitch
                isOn={voiceInputEnabled}
                handleToggle={toggleVoiceInput}
                label="Voice"
              />
            </div>

            {voiceInputEnabled && (
              <div className="control-group">
                <ToggleSwitch
                  isOn={continuousConversation}
                  handleToggle={() => setContinuousConversation(!continuousConversation)}
                  label="Auto"
                  disabled={!voiceInputEnabled}
                />
              </div>
            )}

            <button
              className="debug-toggle"
              onClick={() => setDebugMode(!debugMode)}
            >
              {debugMode ? 'Hide' : 'Debug'}
            </button>

            <button
              className="settings-toggle close-icon"
              onClick={() => setShowControls(false)}
              aria-label="Close settings"
            >
              ✕
            </button>
          </>
        ) : (
          <button
            className="settings-toggle"
            onClick={() => setShowControls(true)}
            aria-label="Open settings"
          >
            ⚙️
          </button>
        )}
      </div>
    </div>
  );
};

export default TutorHeader;