import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/divider/divider.js'
import App from './app/App'
import './styles/tokens.css'
import './styles/tailwind.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
