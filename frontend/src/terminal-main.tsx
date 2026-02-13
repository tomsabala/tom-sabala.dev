import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import TerminalApp from './terminal/TerminalApp'
import './terminal/styles/terminal.css'

createRoot(document.getElementById('terminal-root')!).render(
  <StrictMode>
    <TerminalApp />
    <Analytics />
  </StrictMode>,
)
