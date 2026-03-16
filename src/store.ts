import { create } from 'zustand'
import type { ShoppingList, Item, Settings } from './types'

interface AppStore {
  // Lists
  lists: ShoppingList[]
  setLists: (lists: ShoppingList[]) => void
  upsertList: (list: ShoppingList) => void
  removeList: (id: number) => void

  // Current list items
  items: Item[]
  setItems: (items: Item[]) => void
  addItemToStore: (item: Item) => void
  updateItemInStore: (id: number, updates: Partial<Item>) => void
  removeItemFromStore: (id: number) => void

  // Walmart lookup status
  lookingUp: Set<number>
  setLookingUp: (id: number, loading: boolean) => void

  // Settings
  settings: Settings
  setSettings: (s: Settings) => void
}

export const useStore = create<AppStore>((set) => ({
  lists: [],
  setLists: (lists) => set({ lists }),
  upsertList: (list) =>
    set(state => {
      const idx = state.lists.findIndex(l => l.id === list.id)
      if (idx >= 0) {
        const next = [...state.lists]
        next[idx] = list
        return { lists: next }
      }
      return { lists: [list, ...state.lists] }
    }),
  removeList: (id) =>
    set(state => ({ lists: state.lists.filter(l => l.id !== id) })),

  items: [],
  setItems: (items) => set({ items }),
  addItemToStore: (item) =>
    set(state => ({ items: [...state.items, item] })),
  updateItemInStore: (id, updates) =>
    set(state => ({
      items: state.items.map(i => (i.id === id ? { ...i, ...updates } : i))
    })),
  removeItemFromStore: (id) =>
    set(state => ({ items: state.items.filter(i => i.id !== id) })),

  lookingUp: new Set(),
  setLookingUp: (id, loading) =>
    set(state => {
      const next = new Set(state.lookingUp)
      loading ? next.add(id) : next.delete(id)
      return { lookingUp: next }
    }),

  settings: { store_id: '' },
  setSettings: (settings) => set({ settings }),
}))
