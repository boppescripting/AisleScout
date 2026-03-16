import { Router, Request } from 'express'
import type { InValue } from '@libsql/client'
import { db } from '../db'

const router = Router({ mergeParams: true })

// GET /api/lists/:listId/items
router.get('/', async (req: Request<{ listId: string }>, res) => {
  const listId = Number(req.params.listId)
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM items WHERE list_id = ? ORDER BY created_at ASC',
      args: [listId]
    })
    // Convert SQLite integers to booleans for checked
    const items = result.rows.map(row => ({
      ...row,
      checked: Boolean(row.checked)
    }))
    res.json(items)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch items' })
  }
})

// POST /api/lists/:listId/items
router.post('/', async (req: Request<{ listId: string }>, res) => {
  const listId = Number(req.params.listId)
  const { name, quantity = 1 } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' })
  try {
    const result = await db.execute({
      sql: `INSERT INTO items (list_id, name, quantity) VALUES (?, ?, ?) RETURNING *`,
      args: [listId, name.trim(), Math.max(1, Number(quantity))]
    })
    // Update list's updated_at
    await db.execute({
      sql: "UPDATE shopping_lists SET updated_at = datetime('now') WHERE id = ?",
      args: [listId]
    })
    res.status(201).json({ ...result.rows[0], checked: false })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add item' })
  }
})

// PUT /api/items/:id — update any fields
const itemsRouter = Router()

itemsRouter.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const fields = req.body as Record<string, unknown>
  const allowed = ['name', 'quantity', 'checked', 'price', 'department', 'aisle', 'walmart_item_id']

  const updates: string[] = []
  const args: InValue[] = []

  for (const key of allowed) {
    if (key in fields) {
      if (key === 'checked') {
        updates.push(`${key} = ?`)
        args.push(fields[key] ? 1 : 0)
      } else {
        updates.push(`${key} = ?`)
        args.push((fields[key] as InValue) ?? null)
      }
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' })

  args.push(id)

  try {
    const result = await db.execute({
      sql: `UPDATE items SET ${updates.join(', ')} WHERE id = ? RETURNING *`,
      args
    })
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' })
    res.json({ ...result.rows[0], checked: Boolean(result.rows[0].checked) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update item' })
  }
})

// DELETE /api/items/:id
itemsRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  try {
    await db.execute({ sql: 'DELETE FROM items WHERE id = ?', args: [id] })
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete item' })
  }
})

export { router as listItemsRouter, itemsRouter }
