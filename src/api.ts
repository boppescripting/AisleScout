import axios from 'axios'
import type { ShoppingList, Item, WalmartResult, Settings } from './types'

const http = axios.create({ baseURL: '/api' })

// Lists
export const getLists = () =>
  http.get<ShoppingList[]>('/lists').then(r => r.data)

export const createList = (name: string) =>
  http.post<ShoppingList>('/lists', { name }).then(r => r.data)

export const updateList = (id: number, name: string) =>
  http.put<ShoppingList>(`/lists/${id}`, { name }).then(r => r.data)

export const deleteList = (id: number) =>
  http.delete(`/lists/${id}`)

// Items
export const getItems = (listId: number) =>
  http.get<Item[]>(`/lists/${listId}/items`).then(r => r.data)

export const addItem = (listId: number, name: string, quantity = 1) =>
  http.post<Item>(`/lists/${listId}/items`, { name, quantity }).then(r => r.data)

export const updateItem = (id: number, data: Partial<Item>) =>
  http.put<Item>(`/items/${id}`, data).then(r => r.data)

export const deleteItem = (id: number) =>
  http.delete(`/items/${id}`)

// Walmart
export const searchWalmart = (q: string) =>
  http.get<WalmartResult>(`/walmart/search?q=${encodeURIComponent(q)}`).then(r => r.data)

// Settings
export const getSettings = () =>
  http.get<Settings>('/settings').then(r => r.data)

export const saveSetting = (key: string, value: string) =>
  http.put(`/settings/${key}`, { value }).then(r => r.data)

export const clearCache = () =>
  http.delete<{ cleared: number }>('/settings/cache').then(r => r.data)

export const saveWalmartAisle = (walmartItemId: string, aisle: string | null) =>
  http.put('/walmart/aisle', { walmartItemId, aisle }).then(r => r.data)
