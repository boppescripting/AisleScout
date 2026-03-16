import { ExternalLink, Save, Store, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { clearCache, getSettings, saveSetting } from '../api'
import Header from '../components/Header'
import { useStore } from '../store'

export default function SettingsPage() {
  const { settings, setSettings } = useStore()
  const [storeId, setStoreId] = useState(settings.store_id)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState<number | null>(null)

  const handleClearCache = async () => {
    setClearing(true)
    try {
      const { cleared } = await clearCache()
      setCleared(cleared)
      setTimeout(() => setCleared(null), 3000)
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s)
      setStoreId(s.store_id)
    })
  }, [setSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveSetting('store_id', storeId.trim())
      setSettings({ ...settings, store_id: storeId.trim() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Settings" showBack />

      <main className="flex-1 px-4 py-6 space-y-4">

        {/* Walmart Store Number */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Store size={16} className="text-primary" />
            <h2 className="font-semibold text-gray-700 text-sm">Walmart Store</h2>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                Store Number
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={storeId}
                onChange={e => setStoreId(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 4299"
                className="w-full bg-gray-100 rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                maxLength={6}
              />
            </div>
            <div className="bg-primary-50 rounded-xl p-3 text-sm text-primary-700">
              <p className="font-medium mb-1">How to find your store number:</p>
              <ol className="list-decimal list-inside space-y-1 text-primary-600 text-sm">
                <li>Go to <strong>walmart.com</strong> and click "Select a store"</li>
                <li>Pick your store — the number is in the URL:</li>
              </ol>
              <code className="block mt-2 bg-white/60 rounded-lg px-3 py-1.5 text-xs font-mono text-primary-800 break-all">
                walmart.com/store/<strong>4299</strong>/...
              </code>
            </div>
          </div>
        </section>

        {/* Cache */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Trash2 size={16} className="text-primary" />
            <h2 className="font-semibold text-gray-700 text-sm">Price Cache</h2>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-500">
              Walmart prices are cached for 24 hours. Clear the cache to force fresh lookups — useful after fixing missing aisle info.
            </p>
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className="flex items-center gap-2 text-sm font-medium text-red-500 border border-red-200 bg-red-50 rounded-xl px-4 py-2.5 active:bg-red-100 disabled:opacity-60 transition-colors"
            >
              {clearing ? (
                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              {cleared !== null ? `Cleared ${cleared} cached item${cleared !== 1 ? 's' : ''}` : 'Clear Price Cache'}
            </button>
          </div>
        </section>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 disabled:opacity-60 active:bg-primary-600 transition-colors"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : saved ? (
            <>
              <svg viewBox="0 0 16 16" className="w-4 h-4 fill-none stroke-current stroke-2">
                <polyline points="2,8 6,12 14,4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Saved!
            </>
          ) : (
            <>
              <Save size={16} />
              Save Settings
            </>
          )}
        </button>

        <a
          href="https://www.walmart.com/store/finder"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-sm text-gray-400"
        >
          <ExternalLink size={13} />
          Walmart Store Finder
        </a>
      </main>
    </div>
  )
}
