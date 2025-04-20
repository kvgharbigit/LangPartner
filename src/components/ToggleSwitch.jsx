// ToggleSwitch.jsx
import React from 'react';

const ToggleSwitch = ({ isOn, handleToggle, label = '', disabled = false }) => {
  return (
    <div
      className="toggle-container"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px'
      }}
    >
      {label && <label style={{ cursor: 'pointer' }} onClick={disabled ? null : handleToggle}>{label}</label>}

      <div
        className={`toggle-button ${isOn ? 'active' : ''}`}
        onClick={disabled ? null : handleToggle}
        style={{
          position: 'relative',
          width: '50px',
          height: '26px',
          backgroundColor: isOn ? '#128c7e' : '#ccc',
          borderRadius: '26px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.3s',
          opacity: disabled ? 0.6 : 1
        }}
      >
        <div
          className="toggle-button-knob"
          style={{
            position: 'absolute',
            left: isOn ? '26px' : '3px',
            top: '3px',
            width: '20px',
            height: '20px',
            backgroundColor: 'white',
            borderRadius: '50%',
            transition: 'left 0.3s'
          }}
        />
      </div>
    </div>
  );
};

export default ToggleSwitch;