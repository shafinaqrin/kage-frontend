import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/divider/divider.js'
import App from './app/App'
import './styles/tokens.css'
import './styles/tailwind.css'
import './styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
