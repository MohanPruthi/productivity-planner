import React from 'react';

const Loader = ({ text = "Syncing workspace...", fullScreen = false }) => {
  const containerStyle = fullScreen ? {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'var(--bg-primary)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem'
  } : {};

  return (
    <div className={fullScreen ? "" : "premium-loader-container"} style={containerStyle}>
      <div className="premium-loader-ring" />
      <span className="premium-loader-text">{text}</span>
    </div>
  );
};

export default Loader;
