import { Router } from 'express'
import { db } from '../db'

const router = Router()

// GET /api/settings
router.get('/', async (_req, res) => {
  try {
    const result = await db.execute('SELECT key, value FROM settings')
    const settings: Record<string, string> = {}
    for (const row of result.rows) {
      settings[row.key as string] = (row.value as string) ?? ''
    }
    res.json(settings)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

// PUT /api/settings/:key
router.put('/:key', async (req, res) => {
  const { key } = req.params
  const { value } = req.body
  try {
    await db.execute({
      sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      args: [key, value ?? '']
    })
    res.json({ key, value: value ?? '' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update setting' })
  }
})

// DELETE /api/settings/cache
router.delete('/cache', async (_req, res) => {
  try {
    const result = await db.execute('DELETE FROM walmart_cache')
    console.log(`[Cache] Cleared ${result.rowsAffected} entries`)
    res.json({ cleared: result.rowsAffected })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to clear cache' })
  }
})

export default router
