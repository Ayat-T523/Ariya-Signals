import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import posthog from 'posthog-js'
import './index.css'
import App from './App'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY?.trim()
if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    capture_pageview: false,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
      mask_all_text: false,
    },
  })
}

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim()

const clerkAppearance = {
  variables: {
    colorPrimary: '#0055BB',
    colorText: '#050A44',
    colorTextSecondary: 'rgba(5,10,68,0.55)',
    colorBackground: '#FFFFFF',
    fontFamily: 'Satoshi, sans-serif',
    borderRadius: '12px',
  },
  elements: {
    card: {
      boxShadow: '0 8px 40px rgba(5,10,68,0.10)',
      border: '1px solid rgba(5,10,68,0.08)',
      borderRadius: '16px',
    },
    headerTitle: { fontWeight: 700 },
    formButtonPrimary: { fontFamily: 'Satoshi, sans-serif', fontWeight: 600 },
  },
}

const root = createRoot(document.getElementById('root')!)

if (CLERK_KEY) {
  root.render(
    <StrictMode>
      <ClerkProvider
        publishableKey={CLERK_KEY}
        signInForceRedirectUrl="/"
        signUpForceRedirectUrl="/"
        signInUrl="/sign-in"
        appearance={clerkAppearance}
      >
        <App />
      </ClerkProvider>
    </StrictMode>,
  )
} else {
  // No Clerk key — render without auth (local dev without credentials)
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
