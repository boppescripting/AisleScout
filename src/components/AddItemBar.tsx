import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'

interface AddItemBarProps {
  onAdd: (name: string) => void
}

export default function AddItemBar({ onAdd }: AddItemBarProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
    inputRef.current?.focus()
  }

  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 safe-bottom shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Add an item…"
          className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all placeholder:text-gray-400"
          autoComplete="off"
          autoCorrect="off"
        />
        <button
          onClick={submit}
          disabled={!value.trim()}
          className="bg-primary text-white rounded-xl px-4 py-3 font-semibold flex items-center gap-1.5 disabled:opacity-40 active:bg-primary-600 transition-colors"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>
    </div>
  )
}
