import { ShoppingCart, Trash2 } from 'lucide-react'
import type { ShoppingList } from '../types'

interface ListCardProps {
  list: ShoppingList
  onOpen: () => void
  onDelete: () => void
}

export default function ListCard({ list, onOpen, onDelete }: ListCardProps) {
  const progress = list.item_count > 0
    ? Math.round((list.checked_count / list.item_count) * 100)
    : 0

  const total = list.estimated_total != null && list.estimated_total > 0
    ? `~$${list.estimated_total.toFixed(2)}`
    : null

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-start p-4 gap-3">
        <div className="bg-primary-50 text-primary rounded-xl p-2.5 mt-0.5 shrink-0">
          <ShoppingCart size={22} />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 text-base leading-snug truncate pr-2">
            {list.name}
          </h2>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm text-gray-500">
              {list.item_count} {list.item_count === 1 ? 'item' : 'items'}
            </span>
            {total && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-sm font-medium text-primary">{total}</span>
              </>
            )}
            {list.checked_count > 0 && list.item_count > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-sm text-emerald-600 font-medium">
                  {list.checked_count}/{list.item_count} done
                </span>
              </>
            )}
          </div>

          {list.item_count > 0 && (
            <div className="mt-2.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="p-2 -mr-1 text-gray-300 hover:text-red-400 active:text-red-500 rounded-lg transition-colors"
          aria-label="Delete list"
        >
          <Trash2 size={17} />
        </button>
      </div>
    </div>
  )
}
