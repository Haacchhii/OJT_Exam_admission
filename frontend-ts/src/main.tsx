import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { startPerfVitalsReporting } from './utils/perfVitals'

if (import.meta.env.PROD && import.meta.env.VITE_ENABLE_PERF_VITALS === 'true') {
  startPerfVitalsReporting()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
