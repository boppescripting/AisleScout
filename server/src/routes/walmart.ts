import { Router } from 'express'
import { db } from '../db'
import { searchWalmart, searchOpenFoodFacts, guessDepartmentByKeyword, debugSearch, WalmartProduct } from '../walmart'

const router = Router()

async function getSettings() {
  const rows = await db.execute(
    "SELECT key, value FROM settings WHERE key IN ('store_id', 'walmart_cookie')"
  )
  const map: Record<string, string> = {}
  for (const r of rows.rows) map[r.key as string] = (r.value as string) ?? ''
  return {
    storeId: map['store_id'] || undefined,
    cookieHeader: map['walmart_cookie'] || undefined,
  }
}

function cap<T>(promise: Promise<T | null>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ])
}

// Merge results from multiple sources. Walmart wins for price/aisle/itemId,
// but department is filled from OFF or keyword if Walmart's is null.
function mergeResults(
  walmart: WalmartProduct | null,
  off: WalmartProduct | null,
  keyword: WalmartProduct | null
): WalmartProduct | null {
  if (!walmart && !off && !keyword) return null

  const deptSource = walmart?.department ? walmart : off?.department ? off : keyword?.department ? keyword : null

  return {
    productName: walmart?.productName ?? off?.productName ?? null,
    price: walmart?.price ?? null,
    department: deptSource?.department ?? null,
    aisle: walmart?.aisle ?? null,
    walmartItemId: walmart?.walmartItemId ?? null,
    source: walmart?.price != null ? 'walmart' : off?.department ? 'openfoodfacts' : 'keyword',
  }
}

// GET /api/walmart/search?q=maple+pecan+k-cup
router.get('/search', async (req, res) => {
  const query = (req.query.q as string)?.trim()
  if (!query) return res.status(400).json({ error: 'q is required' })

  try {
    const { storeId, cookieHeader } = await getSettings()
    const cacheKey = `${query.toLowerCase()}:${storeId || ''}`

    const cached = await db.execute({
      sql: `SELECT * FROM walmart_cache
            WHERE cache_key = ?
              AND datetime(cached_at) > datetime('now', '-24 hours')`,
      args: [cacheKey]
    })
    if (cached.rows.length > 0) {
      const r = cached.rows[0]
      return res.json({
        productName: r.product_name, price: r.price, department: r.department,
        aisle: r.aisle, walmartItemId: r.walmart_item_id,
        source: r.source ?? null, fromCache: true,
      })
    }

    // Run all three sources in parallel:
    //   - Walmart:  capped at 6s (fast-fails on bot challenge ~2s)
    //   - OFF:      capped at 5s
    //   - Keyword:  instant, no network
    const keywordDept = guessDepartmentByKeyword(query)
    const keywordResult: WalmartProduct | null = keywordDept
      ? { productName: null, price: null, department: keywordDept, aisle: null, walmartItemId: null, source: 'keyword' }
      : null

    const [walmart, off] = await Promise.all([
      cap(searchWalmart(query, storeId, cookieHeader), 20_000),
      cap(searchOpenFoodFacts(query), 5_000),
    ])

    console.log(`[Lookup] walmart=${walmart ? `$${walmart.price} / ${walmart.department}` : 'null'} off=${off?.department ?? 'null'} keyword=${keywordDept ?? 'null'}`)

    const result = mergeResults(walmart, off, keywordResult)

    if (result) {
      await db.execute({
        sql: `INSERT OR REPLACE INTO walmart_cache
                (cache_key, product_name, price, department, aisle, walmart_item_id, source, cached_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [cacheKey, result.productName, result.price, result.department,
               result.aisle, result.walmartItemId, result.source]
      })
    }

    res.json({ ...(result ?? {}), fromCache: false })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Lookup failed' })
  }
})

// GET /api/walmart/debug?q=maple+pecan+k-cup
router.get('/debug', async (req, res) => {
  const query = (req.query.q as string)?.trim()
  if (!query) return res.status(400).json({ error: 'q is required' })
  const { storeId, cookieHeader } = await getSettings()
  res.json(await debugSearch(query, storeId, cookieHeader))
})

export default router
