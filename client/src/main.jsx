import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import './index.css';
import { initTheme } from './theme';
import './themes/classic.css';
import './themes/synthwave.css';
import './themes/holo.css';
import './themes/aurora.css';
import './themes/notebook.css';
import { queryClient, restoreQueryCache, startPersistingQueryCache } from './lib/queryClient';
import { installQueryEvents } from './lib/queryEvents';

initTheme();

// Hidden tab: pause CSS animations (see :root[data-hidden] in index.css)
const syncHidden = () => document.documentElement.toggleAttribute('data-hidden', document.hidden);
document.addEventListener('visibilitychange', syncHidden);
syncHidden();

// Page cache: last session's lists first, then keep it saved and in step with app events
restoreQueryCache();
startPersistingQueryCache();
installQueryEvents();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
