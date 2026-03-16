import { Plus, ShoppingCart } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createList, deleteList, getLists } from '../api'
import Header from '../components/Header'
import ListCard from '../components/ListCard'
import { useStore } from '../store'

export default function ListsPage() {
  const navigate = useNavigate()
  const { lists, setLists, upsertList, removeList } = useStore()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getLists()
      .then(setLists)
      .finally(() => setLoading(false))
  }, [setLists])

  useEffect(() => {
    if (creating) setTimeout(() => inputRef.current?.focus(), 50)
  }, [creating])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setNewName('')
    setCreating(false)
    const list = await createList(name)
    upsertList({ ...list, item_count: 0, checked_count: 0, estimated_total: null })
  }

  const handleDelete = async (id: number) => {
    removeList(id)
    await deleteList(id)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="AisleScout" showSettings />

      <main className="flex-1 px-4 py-4 space-y-3 pb-24">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <div className="bg-primary-50 text-primary rounded-full p-5 mb-4">
              <ShoppingCart size={36} />
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No lists yet</h2>
            <p className="text-gray-400 text-sm">Tap the button below to create your first shopping list.</p>
          </div>
        ) : (
          lists.map(list => (
            <ListCard
              key={list.id}
              list={list}
              onOpen={() => navigate(`/list/${list.id}`)}
              onDelete={() => handleDelete(list.id)}
            />
          ))
        )}
      </main>

      {/* New list form overlay */}
      {creating && (
        <div
          className="fixed inset-0 bg-black/40 z-30 flex items-end"
          onClick={() => setCreating(false)}
        >
          <div
            className="w-full max-w-2xl mx-auto bg-white rounded-t-2xl p-5 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-3">New Shopping List</h2>
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setCreating(false)
              }}
              placeholder="List name…"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary"
              autoComplete="off"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setCreating(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      {!creating && (
        <button
          onClick={() => setCreating(true)}
          className="fixed bottom-6 right-6 bg-primary text-white rounded-2xl shadow-lg px-5 py-3.5 flex items-center gap-2 font-semibold text-base active:bg-primary-600 transition-colors z-20"
        >
          <Plus size={20} />
          New List
        </button>
      )}
    </div>
  )
}
