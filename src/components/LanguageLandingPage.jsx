import React, { useState } from 'react';

const LanguageLandingPage = ({ onLanguageSelect }) => {
  const [nativeLanguage, setNativeLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [isLoading, setIsLoading] = useState(false);

  // Available languages
  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' }
  ];

  const handleStartLearning = () => {
    if (!nativeLanguage || !targetLanguage) {
      return;
    }

    setIsLoading(true);

    // Simulate loading and then pass the selection to parent component
    setTimeout(() => {
      if (onLanguageSelect) {
        onLanguageSelect({
          nativeLanguage,
          targetLanguage,
          difficulty
        });
      }
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="landing-container">
      <div className="landing-header">
        <h1>LangLearn</h1>
        <p className="tagline">Your AI-powered language learning companion</p>
      </div>

      <div className="language-selection-card">
        <h2>Choose Your Languages</h2>

        <div className="language-section">
          <h3>I speak:</h3>
          <div className="language-options">
            {languages.map(lang => (
              <div
                key={`native-${lang.code}`}
                className={`language-option ${nativeLanguage === lang.code ? 'selected' : ''}`}
                onClick={() => setNativeLanguage(lang.code)}
              >
                <span className="language-flag">{lang.flag}</span>
                <span className="language-name">{lang.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="language-section">
          <h3>I want to learn:</h3>
          <div className="language-options">
            {languages.map(lang => (
              <div
                key={`target-${lang.code}`}
                className={`language-option ${targetLanguage === lang.code ? 'selected' : ''} ${nativeLanguage === lang.code ? 'disabled' : ''}`}
                onClick={() => nativeLanguage !== lang.code && setTargetLanguage(lang.code)}
              >
                <span className="language-flag">{lang.flag}</span>
                <span className="language-name">{lang.name}</span>
                {nativeLanguage === lang.code && (
                  <div className="disabled-overlay">
                    <span>Already speak</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="language-section">
          <h3>My level:</h3>
          <div className="difficulty-options">
            {['beginner', 'intermediate', 'advanced'].map(level => (
              <div
                key={level}
                className={`language-option ${difficulty === level ? 'selected' : ''}`}
                onClick={() => setDifficulty(level)}
              >
                <span className="difficulty-icon">
                  {level === 'beginner' ? '🌱' : level === 'intermediate' ? '🌿' : '🌳'}
                </span>
                <span className="language-name">
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          className={`start-button ${(!nativeLanguage || !targetLanguage) ? 'disabled' : ''} ${isLoading ? 'loading' : ''}`}
          onClick={handleStartLearning}
          disabled={!nativeLanguage || !targetLanguage || isLoading}
        >
          {isLoading ? (
            <span className="loading-spinner"></span>
          ) : (
            <>Start Learning</>
          )}
        </button>
      </div>

      <div className="landing-features">
        <div className="feature">
          <div className="feature-icon">🎙️</div>
          <h3>Voice Conversation</h3>
          <p>Practice speaking with our AI tutor and get instant feedback</p>
        </div>
        <div className="feature">
          <div className="feature-icon">✍️</div>
          <h3>Grammar Correction</h3>
          <p>Learn from your mistakes with real-time corrections</p>
        </div>
        <div className="feature">
          <div className="feature-icon">🔄</div>
          <h3>Natural Alternatives</h3>
          <p>Discover how native speakers would express the same ideas</p>
        </div>
      </div>
    </div>
  );
};

export default LanguageLandingPage;