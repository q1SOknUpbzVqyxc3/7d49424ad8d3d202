import { createRoot } from 'react-dom/client'
import App from './App'

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('reduce-motion')
}

createRoot(document.getElementById('root')).render(<App />)
