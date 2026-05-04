import { Toaster } from 'react-hot-toast'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <>
      <Dashboard />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
          },
          success: { iconTheme: { primary: '#10b981', secondary: 'white' } },
          error: { iconTheme: { primary: '#ef4444', secondary: 'white' } },
        }}
      />
    </>
  )
}
