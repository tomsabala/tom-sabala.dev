import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { ThemeProvider } from './contexts/ThemeContext'
import AppsLauncher from './apps/AppsLauncher'
import './index.css'

createRoot(document.getElementById('apps-root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppsLauncher />
    </ThemeProvider>
    <Analytics />
  </StrictMode>,
)
