import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { installGlobalErrorLogging } from './lib/runLog'

installGlobalErrorLogging()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Register the PWA service worker, only over http(s). Registered after load so
// it never competes with first paint.
if (
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || location.protocol === 'http:')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err)
    })
  })
}
