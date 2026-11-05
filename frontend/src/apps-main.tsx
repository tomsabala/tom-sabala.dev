import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './contexts/ThemeContext'
import AppsLauncher from './apps/AppsLauncher'
import { initAnalytics } from './analytics/track.ts'
import { GATEWAY_BEACON } from './analytics/endpoints.ts'
import './index.css'

// Same-origin, handled by the broker rather than the backend: this origin's
// admin session is an oauth2-proxy cookie that never leaves it, and the broker
// is the only thing that can prove anon-vs-admin on the visitor's behalf.
initAnalytics({ endpoint: GATEWAY_BEACON })

createRoot(document.getElementById('apps-root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppsLauncher />
    </ThemeProvider>
  </StrictMode>,
)
