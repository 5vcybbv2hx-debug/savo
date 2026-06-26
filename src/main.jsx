import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Only initialize OneSignal on production domain or localhost
if (window.location.hostname === 'bar-shift-pro-fc3522b9.base44.app' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
        await OneSignal.init({
            appId: '664fda20-f8c7-411a-928f-217c855bb2bb',
            serviceWorkerPath: '/OneSignalSDKWorker.js',
            notifyButton: { enable: false },
            allowLocalhostAsSecureOrigin: true,
        });
    });
}

// Build: 2026-06-26 (rebuild #2 — force cache clear)
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)