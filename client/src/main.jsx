import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { initTheme } from './theme';
import './themes/classic.css';
import './themes/synthwave.css';
import './themes/holo.css';
import './themes/aurora.css';

initTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
