import { ArrowLeft, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface HeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  showSettings?: boolean
  right?: React.ReactNode
}

export default function Header({ title, subtitle, showBack, showSettings, right }: HeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="bg-primary text-white px-4 pt-4 pb-3 shadow-md sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="p-1 -ml-1 rounded-full active:bg-primary-600 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={22} />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-sm text-primary-100 leading-tight">{subtitle}</p>
          )}
        </div>

        {right}

        {showSettings && (
          <button
            onClick={() => navigate('/settings')}
            className="p-2 rounded-full active:bg-primary-600 transition-colors"
            aria-label="Settings"
          >
            <Settings size={20} />
          </button>
        )}
      </div>
    </header>
  )
}
