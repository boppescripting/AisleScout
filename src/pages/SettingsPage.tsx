import { ChevronDown, ChevronUp, Cookie, ExternalLink, Save, Store, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearCache, getSettings, saveSetting } from '../api'
import Header from '../components/Header'
import { useStore } from '../store'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { settings, setSettings } = useStore()
  const [storeId, setStoreId] = useState(settings.store_id)
  const [cookie, setCookie] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showCookieHelp, setShowCookieHelp] = useState(false)
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
      setCookie((s as any).walmart_cookie ?? '')
    })
  }, [setSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all([
        saveSetting('store_id', storeId.trim()),
        saveSetting('walmart_cookie', cookie.trim()),
      ])
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

        {/* Walmart Browser Cookie */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Cookie size={16} className="text-primary" />
            <h2 className="font-semibold text-gray-700 text-sm">Walmart Browser Cookie</h2>
            <span className="ml-auto text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
              Required for price lookup
            </span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-500">
              Walmart blocks automated requests. Pasting your browser's cookie lets the server
              look up prices as if it were your browser.
            </p>

            <textarea
              value={cookie}
              onChange={e => setCookie(e.target.value)}
              placeholder="Paste cookie string here…"
              rows={3}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-xs font-mono outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all resize-none"
            />

            <button
              onClick={() => setShowCookieHelp(v => !v)}
              className="flex items-center gap-1.5 text-sm text-primary font-medium"
            >
              {showCookieHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              How to get your cookie
            </button>

            {showCookieHelp && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                <div className="space-y-2">
                  <p className="font-semibold text-gray-700">Chrome / Edge:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600">
                    <li>Open <a href="https://www.walmart.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">walmart.com</a> and browse around briefly</li>
                    <li>Press <kbd className="bg-gray-200 rounded px-1 font-mono text-xs">F12</kbd> to open DevTools</li>
                    <li>Click the <strong>Network</strong> tab</li>
                    <li>Reload the page (<kbd className="bg-gray-200 rounded px-1 font-mono text-xs">F5</kbd>)</li>
                    <li>Click the first request to <strong>www.walmart.com</strong></li>
                    <li>In <strong>Request Headers</strong>, find <code className="bg-gray-200 rounded px-1 font-mono text-xs">Cookie:</code></li>
                    <li>Right-click the value → <strong>Copy value</strong></li>
                    <li>Paste it in the box above</li>
                  </ol>
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-gray-700">Firefox:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600">
                    <li>Open walmart.com, press <kbd className="bg-gray-200 rounded px-1 font-mono text-xs">F12</kbd></li>
                    <li>Click <strong>Network</strong> tab, reload the page</li>
                    <li>Click the first <strong>GET walmart.com</strong> request</li>
                    <li>In <strong>Headers</strong> → <strong>Request Headers</strong>, find <code className="bg-gray-200 rounded px-1 font-mono text-xs">Cookie</code></li>
                    <li>Click the value to select all, then copy</li>
                  </ol>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                  <strong>Note:</strong> Cookies expire after a few hours. If price lookup stops
                  working, come back here and paste a fresh cookie. Open Food Facts is used as a
                  fallback for department info when Walmart fails.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* About */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-semibold text-gray-700 text-sm mb-2">How price lookup works</h2>
          <div className="text-sm text-gray-500 space-y-1.5">
            <p>1. <strong>Walmart</strong> — live price + department from your store (requires cookie)</p>
            <p>2. <strong>Open Food Facts</strong> — department only, no price (free fallback, always works)</p>
            <p>3. <strong>Manual entry</strong> — tap the price on any item to enter it yourself</p>
            <p className="text-xs text-gray-400 pt-1">Lookup results are cached for 24 hours.</p>
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
              Walmart prices are cached for 24 hours. Clear the cache to force fresh lookups — useful after updating your cookie or fixing missing aisle info.
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
