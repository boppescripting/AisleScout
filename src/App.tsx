import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import ListsPage from './pages/ListsPage'
import ListDetailPage from './pages/ListDetailPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('auth_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-full max-w-2xl mx-auto flex flex-col">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><ListsPage /></RequireAuth>} />
          <Route path="/list/:id" element={<RequireAuth><ListDetailPage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
