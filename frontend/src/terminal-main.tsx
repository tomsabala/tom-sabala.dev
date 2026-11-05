import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import TerminalApp from './terminal/TerminalApp'
import { initAnalytics } from './analytics/track.ts'
import { BACKEND_BEACON } from './analytics/endpoints.ts'
import './terminal/styles/terminal.css'

// Outside the tree on purpose: the terminal has no router and exactly one page,
// so there is nothing for a component to react to. The backend recognises this
// origin from the `terminal.` host in `Origin` and files it under its own site.
initAnalytics({ endpoint: BACKEND_BEACON })

createRoot(document.getElementById('terminal-root')!).render(
  <StrictMode>
    <TerminalApp />
  </StrictMode>,
)
