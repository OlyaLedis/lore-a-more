import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { ConvexReactClient } from 'convex/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'
import { HereProvider } from './components/HereProvider'
import { SelectedPlaceProvider } from './components/SelectedPlaceProvider'
import './index.css'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <HereProvider>
        <SelectedPlaceProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SelectedPlaceProvider>
      </HereProvider>
    </ConvexAuthProvider>
  </StrictMode>,
)
