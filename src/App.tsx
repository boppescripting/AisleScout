import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ListsPage from './pages/ListsPage'
import ListDetailPage from './pages/ListDetailPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-full max-w-2xl mx-auto flex flex-col">
        <Routes>
          <Route path="/" element={<ListsPage />} />
          <Route path="/list/:id" element={<ListDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
