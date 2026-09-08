import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DatasetProvider } from './context/DatasetProvider.tsx'
import { ThemeProvider } from './context/ThemeProvider.tsx'

const root = document.documentElement
const initial = window.matchMedia('(prefers-color-scheme: dark)').matches
  ? 'dark'
  : 'light'
const stored = window.localStorage.getItem('spikes-app-theme')
const theme = stored === 'dark' || stored === 'light' ? stored : initial
root.classList.toggle('dark', theme === 'dark')
root.style.colorScheme = theme === 'dark' ? 'dark' : 'light'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <DatasetProvider>
        <App />
      </DatasetProvider>
    </ThemeProvider>
  </StrictMode>,
)
