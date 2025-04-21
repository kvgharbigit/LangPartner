import React, { useState } from 'react';
import '../App.css';
import './LangLearnLanding.css'; // Local import from same directory
import './AppHeader.css'; // Local import from same directory
import SpanishTutor from './SpanishTutor';
import LanguageLandingPage from './LanguageLandingPage';


function AppHead() {
  const [selectedLanguages, setSelectedLanguages] = useState(null);

  const handleLanguageSelect = (languages) => {
    setSelectedLanguages(languages);
  };

  // If languages aren't selected yet, show landing page
  if (!selectedLanguages) {
    return <LanguageLandingPage onLanguageSelect={handleLanguageSelect} />;
  }

  // Once languages are selected, show the language tutor
  return (
    <div className="App app-container">
      {/* Language switcher/header */}
      <div className="app-header">
        <div className="language-info">
          <div className="language-combo">
            <span className="native-language">
              {selectedLanguages.nativeLanguage === 'en' ? '🇬🇧' : '🇪🇸'}
            </span>
            <span className="arrow">→</span>
            <span className="target-language">
              {selectedLanguages.targetLanguage === 'en' ? '🇬🇧' : '🇪🇸'}
            </span>
          </div>
          <button
            className="change-language-btn"
            onClick={() => setSelectedLanguages(null)}
          >
            Change Languages
          </button>
        </div>
      </div>

      {/* Render the Spanish Tutor component with the selected languages */}
      <SpanishTutor
        nativeLanguage={selectedLanguages.nativeLanguage}
        targetLanguage={selectedLanguages.targetLanguage}
      />
    </div>
  );
}

export default AppHead;