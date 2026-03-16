import { ChevronDown, ChevronUp, PackageOpen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { addItem, deleteItem, getItems, searchWalmart, updateItem } from '../api'
import AddItemBar from '../components/AddItemBar'
import Header from '../components/Header'
import ItemRow from '../components/ItemRow'
import { useStore } from '../store'
import type { Item } from '../types'

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>()
  const listId = Number(id)

  const {
    lists,
    items,
    setItems,
    addItemToStore,
    updateItemInStore,
    removeItemFromStore,
    lookingUp,
    setLookingUp,
  } = useStore()

  const list = lists.find(l => l.id === listId)
  const [loading, setLoading] = useState(true)
  const [showChecked, setShowChecked] = useState(false)

  useEffect(() => {
    getItems(listId)
      .then(setItems)
      .finally(() => setLoading(false))
    return () => setItems([])
  }, [listId, setItems])

  // Derived totals
  const { estimatedTotal, remaining, uncheckedWithPrice } = useMemo(() => {
    const withPrice = items.filter(i => i.price != null)
    const uncheckedWithPrice = items.filter(i => !i.checked && i.price != null)
    const estimatedTotal = withPrice.length > 0
      ? withPrice.reduce((s, i) => s + i.price! * i.quantity, 0)
      : null
    const remaining = uncheckedWithPrice.length > 0
      ? uncheckedWithPrice.reduce((s, i) => s + i.price! * i.quantity, 0)
      : null
    return { estimatedTotal, remaining, uncheckedWithPrice }
  }, [items])

  // Group unchecked items by department
  const { deptGroups, checkedItems } = useMemo(() => {
    const unchecked = items.filter(i => !i.checked)
    const checkedItems = items.filter(i => i.checked)

    const map = new Map<string, Item[]>()
    for (const item of unchecked) {
      const key = item.department || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }

    // Sort: named departments first, "—" last
    const sorted = new Map(
      [...map.entries()].sort(([a], [b]) => {
        if (a === '—') return 1
        if (b === '—') return -1
        return a.localeCompare(b)
      })
    )

    return { deptGroups: sorted, checkedItems }
  }, [items])

  const runWalmartLookup = async (item: Item) => {
    setLookingUp(item.id, true)
    try {
      const result = await searchWalmart(item.name)
      if (result.price != null || result.department != null) {
        const updated = await updateItem(item.id, {
          name: result.productName ?? undefined,
          price: result.price ?? undefined,
          department: result.department ?? undefined,
          aisle: result.aisle ?? undefined,
          walmart_item_id: result.walmartItemId ?? undefined,
        })
        updateItemInStore(item.id, updated)
      }
    } catch (err) {
      console.error('Walmart lookup failed:', err)
    } finally {
      setLookingUp(item.id, false)
    }
  }

  const handleAddItem = async (name: string) => {
    // Optimistic: add a placeholder immediately
    const placeholder: Item = {
      id: -Date.now(), // temp id
      list_id: listId,
      name,
      quantity: 1,
      checked: false,
      price: null,
      department: null,
      aisle: null,
      walmart_item_id: null,
      created_at: new Date().toISOString(),
    }
    addItemToStore(placeholder)

    try {
      const real = await addItem(listId, name)
      // Replace placeholder with real item
      removeItemFromStore(placeholder.id)
      addItemToStore(real)
      // Auto-lookup in background
      runWalmartLookup(real)
    } catch {
      removeItemFromStore(placeholder.id)
    }
  }

  const handleToggle = async (item: Item) => {
    const next = !item.checked
    updateItemInStore(item.id, { checked: next })
    try {
      await updateItem(item.id, { checked: next })
    } catch {
      updateItemInStore(item.id, { checked: !next })
    }
  }

  const handleQtyChange = async (item: Item, qty: number) => {
    updateItemInStore(item.id, { quantity: qty })
    await updateItem(item.id, { quantity: qty })
  }

  const handleDelete = async (item: Item) => {
    removeItemFromStore(item.id)
    await deleteItem(item.id)
  }

  const handleManualEdit = async (item: Item, price: number | null, department: string | null, aisle: string | null) => {
    updateItemInStore(item.id, { price, department, aisle })
    await updateItem(item.id, { price: price ?? undefined, department: department ?? undefined, aisle: aisle ?? undefined })
  }

  const totalCount = items.length
  const checkedCount = checkedItems.length
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0

  const subtitle = useMemo(() => {
    if (remaining != null) {
      const pricedCount = uncheckedWithPrice.length
      const unpricedCount = items.filter(i => !i.checked && i.price == null).length
      let s = `~$${remaining.toFixed(2)} remaining`
      if (unpricedCount > 0) s += ` + ${unpricedCount} unlisted`
      return s
    }
    if (estimatedTotal != null) return `~$${estimatedTotal.toFixed(2)} estimated`
    return `${totalCount} items`
  }, [remaining, estimatedTotal, totalCount, uncheckedWithPrice, items])

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title={list?.name ?? 'List'}
        subtitle={subtitle}
        showBack
      />

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="bg-primary h-1.5">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center px-6">
            <div className="bg-gray-100 rounded-full p-5 mb-4 text-gray-400">
              <PackageOpen size={36} />
            </div>
            <h2 className="text-xl font-semibold text-gray-600 mb-2">List is empty</h2>
            <p className="text-gray-400 text-sm">Type something in the box below to add your first item.</p>
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-5">
            {/* Unchecked items grouped by department */}
            {[...deptGroups.entries()].map(([dept, deptItems]) => (
              <section key={dept}>
                {dept !== '—' && (
                  <h3 className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-2 px-1">
                    {dept}
                  </h3>
                )}
                <div className="space-y-2">
                  {deptItems.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      isLookingUp={lookingUp.has(item.id)}
                      onToggle={() => handleToggle(item)}
                      onQtyChange={qty => handleQtyChange(item, qty)}
                      onDelete={() => handleDelete(item)}
                      onLookup={() => runWalmartLookup(item)}
                      onManualEdit={(price, dept, aisle) => handleManualEdit(item, price, dept, aisle)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {/* Checked items collapsible */}
            {checkedItems.length > 0 && (
              <section>
                <button
                  onClick={() => setShowChecked(v => !v)}
                  className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-gray-400 mb-2 px-1 w-full"
                >
                  {showChecked ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  In cart ({checkedItems.length})
                </button>
                {showChecked && (
                  <div className="space-y-2">
                    {checkedItems.map(item => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        isLookingUp={lookingUp.has(item.id)}
                        onToggle={() => handleToggle(item)}
                        onQtyChange={qty => handleQtyChange(item, qty)}
                        onDelete={() => handleDelete(item)}
                        onLookup={() => runWalmartLookup(item)}
                        onManualEdit={(price, dept, aisle) => handleManualEdit(item, price, dept, aisle)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      <AddItemBar onAdd={handleAddItem} />
    </div>
  )
}
