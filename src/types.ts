export interface ShoppingList {
  id: number
  name: string
  created_at: string
  updated_at: string
  item_count: number
  checked_count: number
  estimated_total: number | null
}

export interface Item {
  id: number
  list_id: number
  name: string
  quantity: number
  checked: boolean
  price: number | null
  department: string | null
  aisle: string | null
  walmart_item_id: string | null
  created_at: string
}

export interface WalmartResult {
  productName: string | null
  price: number | null
  department: string | null
  aisle: string | null
  walmartItemId: string | null
  fromCache: boolean
}

export interface Settings {
  store_id: string
}
