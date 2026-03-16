import { Loader2, MapPin, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Item } from '../types'

interface ItemRowProps {
  item: Item
  isLookingUp: boolean
  onToggle: () => void
  onQtyChange: (qty: number) => void
  onDelete: () => void
  onLookup: () => void
  onManualEdit: (price: number | null, department: string | null) => void
}

export default function ItemRow({
  item,
  isLookingUp,
  onToggle,
  onQtyChange,
  onDelete,
  onLookup,
  onManualEdit,
}: ItemRowProps) {
  const lineTotal = item.price != null ? item.price * item.quantity : null
  const [editing, setEditing] = useState(false)
  const [priceInput, setPriceInput] = useState('')
  const [deptInput, setDeptInput] = useState('')
  const priceRef = useRef<HTMLInputElement>(null)

  const openEdit = () => {
    setPriceInput(item.price != null ? item.price.toFixed(2) : '')
    setDeptInput(item.department ?? '')
    setEditing(true)
    setTimeout(() => priceRef.current?.focus(), 50)
  }

  const saveEdit = () => {
    const price = priceInput.trim() === '' ? null : parseFloat(priceInput)
    const department = deptInput.trim() || null
    onManualEdit(
      price != null && isFinite(price) && price >= 0 ? price : null,
      department
    )
    setEditing(false)
  }

  return (
    <div
      className={`bg-white rounded-xl border transition-opacity ${
        item.checked ? 'opacity-50 border-gray-100' : 'border-gray-100'
      }`}
    >
      <div className="flex items-start gap-0">
        {/* Checkbox — large touch target */}
        <button
          onClick={onToggle}
          className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-l-xl active:bg-gray-50 transition-colors"
          aria-label={item.checked ? 'Uncheck item' : 'Check item'}
        >
          <div
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              item.checked
                ? 'bg-emerald-500 border-emerald-500'
                : 'border-gray-300'
            }`}
          >
            {item.checked && (
              <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 text-white fill-none stroke-current stroke-2">
                <polyline points="2,6 5,9 10,3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 py-2.5 pr-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-base font-medium leading-tight ${
                item.checked ? 'line-through text-gray-400' : 'text-gray-900'
              }`}
            >
              {item.name}
            </span>

            {/* Price */}
            <div className="shrink-0 flex items-center gap-1">
              {isLookingUp ? (
                <Loader2 size={15} className="text-primary animate-spin" />
              ) : lineTotal != null ? (
                <button
                  onClick={openEdit}
                  className={`text-sm font-semibold ${item.checked ? 'text-gray-400' : 'text-gray-800'} active:text-primary`}
                  title="Edit price"
                >
                  ${lineTotal.toFixed(2)}
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={onLookup}
                    className="text-xs text-gray-400 hover:text-primary flex items-center gap-0.5"
                    title="Search Walmart for price"
                  >
                    <RefreshCw size={11} />
                    <span>lookup</span>
                  </button>
                  <span className="text-gray-200">|</span>
                  <button
                    onClick={openEdit}
                    className="text-xs text-gray-400 hover:text-primary flex items-center gap-0.5"
                    title="Enter price manually"
                  >
                    <Pencil size={11} />
                    <span>manual</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {item.department ? (
              <button
                onClick={openEdit}
                className="inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full font-medium active:bg-primary-100"
                title="Edit department"
              >
                <MapPin size={10} />
                {item.department}
                {item.aisle && <span className="text-primary-400">· {item.aisle}</span>}
              </button>
            ) : !isLookingUp && (
              <button
                onClick={openEdit}
                className="text-xs text-gray-300 hover:text-gray-400 flex items-center gap-0.5"
                title="Set department"
              >
                <MapPin size={10} />
                <span>set dept</span>
              </button>
            )}
            {item.price != null && item.quantity > 1 && (
              <span className="text-xs text-gray-400">${item.price.toFixed(2)} ea</span>
            )}
            {isLookingUp && (
              <span className="text-xs text-gray-400 italic">Searching Walmart…</span>
            )}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex flex-col items-center justify-center gap-1 py-2 pr-3 pl-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onQtyChange(Math.max(1, item.quantity - 1))}
              disabled={item.quantity <= 1}
              className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center active:bg-gray-200 disabled:opacity-30 transition-colors"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-5 text-center text-sm font-medium text-gray-700 tabular-nums">
              {item.quantity}
            </span>
            <button
              onClick={() => onQtyChange(item.quantity + 1)}
              className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center active:bg-gray-200 transition-colors"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <button
            onClick={onDelete}
            className="p-1 text-gray-300 hover:text-red-400 active:text-red-500 rounded transition-colors"
            aria-label="Delete item"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Manual edit panel */}
      {editing && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-xl space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Manual entry</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Price per unit ($)</label>
              <input
                ref={priceRef}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={priceInput}
                onChange={e => setPriceInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveEdit()}
                placeholder="0.00"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex-[2]">
              <label className="text-xs text-gray-400 mb-1 block">Department</label>
              <input
                type="text"
                value={deptInput}
                onChange={e => setDeptInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveEdit()}
                placeholder="e.g. Coffee"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 text-sm text-gray-400 px-3 py-1.5 rounded-lg border border-gray-200 bg-white"
            >
              <X size={13} /> Cancel
            </button>
            <button
              onClick={saveEdit}
              className="flex-1 bg-primary text-white text-sm font-medium py-1.5 rounded-lg"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
