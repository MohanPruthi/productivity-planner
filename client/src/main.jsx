import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { initTheme } from './theme';
import './themes/classic.css';
import './themes/synthwave.css';
import './themes/holo.css';
import './themes/aurora.css';
import './themes/notebook.css';

initTheme();

// Hidden tab: pause CSS animations (see :root[data-hidden] in index.css)
const syncHidden = () => document.documentElement.toggleAttribute('data-hidden', document.hidden);
document.addEventListener('visibilitychange', syncHidden);
syncHidden();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
