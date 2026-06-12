import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import posthog from 'posthog-js'
import './index.css'
import App from './App'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    capture_pageview: false,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,   // typed inputs (Ask Ariya, search) are never recorded
      mask_all_text: false,  // visible page text is fine to record
    },
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
