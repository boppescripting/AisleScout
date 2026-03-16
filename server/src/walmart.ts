import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'

const execAsync = promisify(execFile)

export interface WalmartProduct {
  productName: string | null
  price: number | null
  department: string | null
  aisle: string | null
  walmartItemId: string | null
  source: 'walmart' | 'openfoodfacts' | 'keyword' | null
}

export interface WalmartDebug {
  url: string
  fetchMethod: string
  httpStatus: number
  htmlLength: number
  hasNextData: boolean
  pageTitle: string
  searchResultKeys: string[]
  stackCount: number
  itemCount: number
  result: WalmartProduct | null
  error: string | null
}

// ─── curl-impersonate ─────────────────────────────────────────────────────────
// Uses Chrome's exact TLS fingerprint (JA3 hash, cipher suites, extensions,
// HTTP/2 settings frames) — the only reliable way to bypass Akamai bot detection
// from a server. Falls back to Node.js fetch on dev machines where it isn't installed.

// Binary names from curl-impersonate Chrome releases, newest first.
// On Linux: installed by Dockerfile. On Mac: brew install curl-impersonate
const CURL_BINS = ['curl_chrome124', 'curl_chrome116', 'curl_chrome110', 'curl_chrome107']

let _curlBin: string | null | undefined = undefined  // undefined = not yet probed

async function getCurlBin(): Promise<string | null> {
  if (_curlBin !== undefined) return _curlBin

  for (const bin of CURL_BINS) {
    try {
      await execAsync(bin, ['--version'], { timeout: 3_000 })
      console.log(`[curl-impersonate] Using ${bin}`)
      return (_curlBin = bin)
    } catch { /* not found, try next */ }
  }

  console.warn('[curl-impersonate] Not installed — falling back to Node.js fetch (Walmart will likely be blocked). Install with: brew install curl-impersonate  OR  see Dockerfile for Linux.')
  return (_curlBin = null)
}

async function curlFetch(
  url: string,
  cookieHeader: string | undefined,
  timeoutSec: number
): Promise<{ status: number; html: string } | null> {
  const bin = await getCurlBin()
  if (!bin) return null

  const tmpPath = path.join(os.tmpdir(), `wm-${Date.now()}-${Math.random().toString(36).slice(2)}.html`)

  // curl-impersonate handles TLS fingerprint, HTTP/2, and Chrome's default headers
  // automatically. We only need to inject the cookie header on top.
  const args = [
    '-s',                        // silent
    '-L',                        // follow redirects
    '--compressed',              // accept gzip/br
    '--max-time', String(timeoutSec),
    '-o', tmpPath,               // write body to temp file
    '-w', '%{http_code}',        // print status code to stdout
  ]

  if (cookieHeader?.trim()) {
    args.push('-H', `Cookie: ${cookieHeader.trim()}`)
  }

  args.push(url)

  try {
    const { stdout } = await execAsync(bin, args, {
      maxBuffer: 20 * 1024 * 1024,
      timeout: (timeoutSec + 5) * 1000,
    })

    const status = parseInt(stdout.trim())
    if (!status || isNaN(status)) return null

    const html = await fs.promises.readFile(tmpPath, 'utf8')
    return { status, html }
  } catch (err: any) {
    console.warn(`[curl-impersonate] ${err?.message?.slice(0, 100)}`)
    return null
  } finally {
    await fs.promises.unlink(tmpPath).catch(() => {})
  }
}

// ─── Node.js fetch fallback ───────────────────────────────────────────────────
// Used on dev machines without curl-impersonate. Will usually be blocked by
// Walmart's Akamai protection due to TLS fingerprint mismatch.

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Ch-Ua': '"Chromium";v="116", "Google Chrome";v="116", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

async function nodeFetch(
  url: string,
  cookieHeader: string | undefined,
  timeoutMs: number
): Promise<{ status: number; html: string } | null> {
  const headers = cookieHeader?.trim()
    ? { ...FETCH_HEADERS, Cookie: cookieHeader.trim() }
    : FETCH_HEADERS

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers, signal: ctl.signal, redirect: 'follow' })
    clearTimeout(timer)
    return { status: res.status, html: await res.text() }
  } catch (err: any) {
    clearTimeout(timer)
    if (err?.name === 'AbortError') throw new Error('timeout')
    throw err
  }
}

// ─── Unified fetch (curl-impersonate > Node.js fetch) ────────────────────────

async function fetchPage(
  url: string,
  cookieHeader: string | undefined,
  timeoutSec = 15
): Promise<{ status: number; html: string; method: string } | null> {
  // Try curl-impersonate first (real Chrome TLS fingerprint)
  const curl = await curlFetch(url, cookieHeader, timeoutSec)
  if (curl) return { ...curl, method: 'curl-impersonate' }

  // Fall back to Node.js fetch (will likely fail against Akamai)
  const node = await nodeFetch(url, cookieHeader, timeoutSec * 1000)
  if (node) return { ...node, method: 'node-fetch' }

  return null
}

// ─── HTML / JSON parsing ──────────────────────────────────────────────────────

function extractNextData(html: string): Record<string, unknown> | null {
  const m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

function extractPageTitle(html: string): string {
  return html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1]?.trim() ?? ''
}

function findItems(data: Record<string, unknown>): unknown[] {
  const pp = (data as any)?.props?.pageProps
  const sr = pp?.initialData?.searchResult

  for (const stack of (sr?.itemStacks ?? []) as any[]) {
    if (Array.isArray(stack?.items) && stack.items.length > 0) return stack.items
  }
  if (Array.isArray(sr?.items) && sr.items.length > 0) return sr.items

  for (const section of (pp?.initialData?.contentLayout?.sections ?? []) as any[]) {
    for (const mod of (section?.modules ?? []) as any[]) {
      if (Array.isArray(mod?.items) && mod.items.length > 0) return mod.items
      if (Array.isArray(mod?.products) && mod.products.length > 0) return mod.products
    }
  }
  return []
}

function safeNum(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string') { const n = parseFloat(v); return isFinite(n) ? n : null }
  return null
}

function safeStr(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function parseProduct(p: Record<string, any>): Omit<WalmartProduct, 'source'> {
  const price =
    safeNum(p?.priceInfo?.currentPrice?.price) ??
    safeNum(p?.price) ??
    safeNum(p?.priceInfo?.price) ??
    null

  const categoryPath: any[] = p?.category?.path ?? p?.categories ?? []
  return {
    productName: safeStr(p?.name) ?? safeStr(p?.title),
    price,
    department: safeStr(categoryPath[0]?.name) ?? safeStr(p?.department) ?? null,
    aisle: null,
    walmartItemId: safeStr(String(p?.usItemId ?? p?.itemId ?? '')),
  }
}

function isBotPage(title: string): boolean {
  return /robot|captcha|are you human|access denied/i.test(title)
}

// ─── Keyword department guesser ───────────────────────────────────────────────

const KEYWORD_DEPT: Array<[RegExp, string]> = [
  [/k[\s-]?cup|keurig|coffee|espresso|cappuccino|cold\s*brew|french\s*press|creamer|coffee\s*pod/i, 'Coffee'],
  [/\btea\b|chai|matcha|herbal/i, 'Tea'],
  [/\bbeer\b|\bwine\b|spirits|liquor|whiskey|vodka|rum|tequila/i, 'Wine, Beer & Spirits'],
  [/soda|cola|pepsi|coke|sprite|dr\s*pepper|sparkling\s*water|lemonade|gatorade|powerade|energy\s*drink|vitamin\s*water|kool.?aid/i, 'Beverages'],
  [/\bjuice\b(?!.*steak)/i, 'Beverages'],
  [/milk|yogurt|cheese|butter|cream\s*cheese|sour\s*cream|half\s*&?\s*half|heavy\s*cream|\begg(s)?\b|cottage\s*cheese/i, 'Dairy & Eggs'],
  [/chicken|beef|pork|turkey|sausage|bacon|ham|steak|ground\s*meat|hot\s*dog|bratwurst|deli\s*meat|lunch\s*meat|salami|pepperoni/i, 'Meat'],
  [/fish|salmon|tuna|shrimp|seafood|crab|lobster|tilapia|cod|halibut/i, 'Seafood'],
  [/\bfrozen\b|ice\s*cream|popsicle|pizza\s*roll/i, 'Frozen Foods'],
  [/\bbread\b|bagel|croissant|\bbun\b|\broll\b|tortilla|pita|naan|english\s*muffin|\bbiscuit\b/i, 'Bakery & Bread'],
  [/\bcake\b|\bpie\b|cookie|brownie|donut|pastry|cupcake|\bmuffin\b/i, 'Bakery & Bread'],
  [/chip|cracker|pretzel|popcorn|trail\s*mix|granola\s*bar|protein\s*bar|kind\s*bar|clif|rice\s*cake/i, 'Snacks & Candy'],
  [/\bnuts?\b|peanut\s*butter|almond\s*butter|cashew/i, 'Snacks & Candy'],
  [/candy|chocolate|gummy|skittles|m&?m|reese|snickers|starburst|jolly\s*rancher|lollipop|licorice/i, 'Snacks & Candy'],
  [/cereal|oatmeal|\boats\b|granola\b|waffle|pancake|syrup|pop.?tart/i, 'Breakfast & Cereal'],
  [/pasta|spaghetti|\bnoodle\b|mac.{0,5}cheese|ramen|\brice\b|quinoa|couscous/i, 'Pasta & Grains'],
  [/\bsoup\b|broth|stock\b|stew\b|chili\b|\bbeans?\b|lentil|chickpea|\bcanned\b/i, 'Canned Goods'],
  [/ketchup|mustard|mayo|mayonnaise|relish|barbecue|bbq.sauce|hot\s*sauce|ranch|salad\s*dressing|vinegar|soy\s*sauce|salsa|guacamole|hummus/i, 'Condiments & Sauces'],
  [/olive\s*oil|vegetable\s*oil|cooking\s*spray|canola|coconut\s*oil/i, 'Cooking Oils'],
  [/\bflour\b|\bsugar\b|baking\s*soda|baking\s*powder|vanilla\s*extract|cocoa|\byeast\b/i, 'Baking'],
  [/\bspice\b|\bpepper\b|\bsalt\b|seasoning|garlic\s*powder|onion\s*powder|cumin|paprika|oregano|thyme|rosemary|basil|cinnamon|nutmeg/i, 'Spices & Seasonings'],
  [/apple|banana|orange|grape|strawberr|blueberr|raspberr|mango|avocado|peach|\bpear\b|cherry|watermelon|pineapple|\blemon\b|\blime\b/i, 'Produce'],
  [/lettuce|spinach|kale|salad\s*mix|broccoli|carrot|celery|cucumber|tomato|\bonion\b|\bpotato\b|sweet\s*potato|mushroom|zucchini|asparagus|cauliflower|cabbage/i, 'Produce'],
  [/shampoo|conditioner|body\s*wash|\bsoap\b|lotion|moisturizer|deodorant|antiperspirant|toothpaste|toothbrush|floss|mouthwash|razor|shaving|sunscreen/i, 'Health & Beauty'],
  [/makeup|mascara|lipstick|foundation|concealer|eyeshadow|blush|nail\s*polish/i, 'Health & Beauty'],
  [/vitamin|supplement|probiotic|protein\s*powder|melatonin|\bzinc\b|magnesium|omega/i, 'Vitamins & Supplements'],
  [/tylenol|advil|ibuprofen|aspirin|nyquil|dayquil|benadryl|claritin|robitussin|pepto|\btums\b|antacid|bandage|cold\s*(medicine|remedy)/i, 'Pharmacy'],
  [/detergent|laundry|\btide\b|\bgain\b|dryer\s*sheet|fabric\s*softener|\bbleach\b/i, 'Laundry'],
  [/windex|pledge|lysol|febreze|air\s*freshener|disinfect|all.purpose.cleaner|\bmop\b|\bbroom\b|trash\s*bag|garbage\s*bag|sponge|\bscrub\b/i, 'Household Cleaners'],
  [/paper\s*towel|toilet\s*paper|\btissue\b|napkin|paper\s*plate|plastic\s*cup|aluminum\s*foil|plastic\s*wrap|zip.bag|storage\s*bag/i, 'Paper & Plastic'],
  [/diaper|baby\s*food|\bformula\b|\bwipe\b|baby\s*wash|pacifier/i, 'Baby'],
  [/dog\s*food|cat\s*food|pet\s*food|dog\s*treat|cat\s*treat|kitty\s*litter|pet\s*supply/i, 'Pet Supplies'],
]

export function guessDepartmentByKeyword(name: string): string | null {
  for (const [pattern, dept] of KEYWORD_DEPT) {
    if (pattern.test(name)) return dept
  }
  return null
}

// ─── Open Food Facts ──────────────────────────────────────────────────────────

const OFF_MAP: Array<[string, string]> = [
  ['coffee', 'Coffee'], ['tea', 'Tea'],
  ['beverages', 'Beverages'], ['sodas', 'Beverages'],
  ['dairy', 'Dairy & Eggs'], ['cheese', 'Dairy & Eggs'], ['egg', 'Dairy & Eggs'],
  ['meat', 'Meat'], ['seafood', 'Seafood'],
  ['frozen', 'Frozen Foods'],
  ['bread', 'Bakery & Bread'], ['bakery', 'Bakery & Bread'],
  ['snack', 'Snacks & Candy'], ['candy', 'Snacks & Candy'],
  ['cereal', 'Breakfast & Cereal'],
  ['pasta', 'Pasta & Grains'], ['rice', 'Pasta & Grains'],
  ['soup', 'Canned Goods'], ['canned', 'Canned Goods'],
  ['sauce', 'Condiments & Sauces'],
  ['produce', 'Produce'], ['fruit', 'Produce'], ['vegetable', 'Produce'],
  ['vitamin', 'Vitamins & Supplements'],
  ['baby', 'Baby'], ['pet', 'Pet Supplies'],
]

export async function searchOpenFoodFacts(query: string): Promise<WalmartProduct | null> {
  try {
    const url = 'https://world.openfoodfacts.org/cgi/search.pl?' +
      new URLSearchParams({ search_terms: query, action: 'process', json: '1', page_size: '5', fields: 'product_name,categories,brands' })

    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 5_000)
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': 'AisleScout/1.0 (self-hosted grocery list)' },
    })
    clearTimeout(timer)
    if (!res.ok) return null

    const json = await res.json() as any
    const p = (json?.products ?? [])[0]
    if (!p) return null

    const cats: string = (p?.categories ?? '').toLowerCase()
    const department = OFF_MAP.find(([kw]) => cats.includes(kw))?.[1] ?? null
    console.log(`[OFF] "${p?.product_name}" → dept="${department}"`)
    return { productName: safeStr(p?.product_name), price: null, department, aisle: null, walmartItemId: null, source: 'openfoodfacts' }
  } catch (err: any) {
    console.warn(`[OFF] ${err?.name === 'AbortError' ? 'Timed out (5s)' : err?.message}`)
    return null
  }
}

// ─── Main Walmart search ──────────────────────────────────────────────────────

export async function searchWalmart(
  query: string,
  storeId?: string,
  cookieHeader?: string
): Promise<WalmartProduct | null> {
  const params = new URLSearchParams({ q: query })
  if (storeId) params.set('stores', storeId)
  const url = `https://www.walmart.com/search?${params}`

  console.log(`[Walmart] Searching: ${url}`)

  try {
    const fetched = await fetchPage(url, cookieHeader)
    if (!fetched) return null

    const title = extractPageTitle(fetched.html)
    console.log(`[Walmart] HTTP ${fetched.status} via ${fetched.method}, ${fetched.html.length} chars, title="${title}"`)

    if (fetched.status !== 200 || isBotPage(title)) {
      console.warn(`[Walmart] Bot challenge page — ${fetched.method === 'curl-impersonate' ? 'unexpected with curl-impersonate, check cookie' : 'install curl-impersonate to bypass TLS fingerprint check'}`)
      return null
    }

    const data = extractNextData(fetched.html)
    if (!data) {
      console.warn(`[Walmart] No __NEXT_DATA__ in response`)
      return null
    }

    const items = findItems(data)
    console.log(`[Walmart] Found ${items.length} result(s)`)
    if (!items.length) return null

    const result = parseProduct(items[0] as Record<string, any>)
    console.log(`[Walmart] "${result.productName}" $${result.price} dept="${result.department}"`)

    if (storeId && result.walmartItemId) {
      result.aisle = await fetchAisle(storeId, result.walmartItemId, cookieHeader)
    }

    return { ...result, source: 'walmart' }
  } catch (err: any) {
    console.error(`[Walmart] Error: ${err?.message}`)
    return null
  }
}

export async function debugSearch(
  query: string,
  storeId?: string,
  cookieHeader?: string
): Promise<WalmartDebug> {
  const params = new URLSearchParams({ q: query })
  if (storeId) params.set('stores', storeId)
  const url = `https://www.walmart.com/search?${params}`

  const debug: WalmartDebug = {
    url, fetchMethod: '', httpStatus: 0, htmlLength: 0,
    hasNextData: false, pageTitle: '', searchResultKeys: [],
    stackCount: 0, itemCount: 0, result: null, error: null,
  }

  try {
    const fetched = await fetchPage(url, cookieHeader)
    if (!fetched) { debug.error = 'Both curl-impersonate and Node.js fetch failed'; return debug }

    debug.fetchMethod = fetched.method
    debug.httpStatus = fetched.status
    debug.htmlLength = fetched.html.length
    debug.pageTitle = extractPageTitle(fetched.html)

    if (isBotPage(debug.pageTitle)) {
      debug.error = `Bot challenge (${debug.fetchMethod}) — ${debug.fetchMethod === 'curl-impersonate' ? 'check that your cookie is valid' : 'curl-impersonate not installed'}`
      return debug
    }

    const data = extractNextData(fetched.html)
    if (!data) { debug.error = 'No __NEXT_DATA__ found'; return debug }

    debug.hasNextData = true
    const sr = (data as any)?.props?.pageProps?.initialData?.searchResult
    if (sr) debug.searchResultKeys = Object.keys(sr)
    debug.stackCount = (sr?.itemStacks ?? []).length

    const items = findItems(data)
    debug.itemCount = items.length
    if (items.length > 0) {
      debug.result = { ...parseProduct(items[0] as Record<string, any>), source: 'walmart' }
    }
  } catch (err: any) {
    debug.error = err?.message ?? String(err)
  }

  return debug
}

async function fetchAisle(
  storeId: string,
  itemId: string,
  cookieHeader: string | undefined
): Promise<string | null> {
  try {
    const fetched = await fetchPage(
      `https://www.walmart.com/store/${storeId}/product/${itemId}`,
      cookieHeader, 8
    )
    if (!fetched || fetched.status !== 200 || isBotPage(extractPageTitle(fetched.html))) return null

    const data = extractNextData(fetched.html)
    if (!data) return null

    const product = (data as any)?.props?.pageProps?.initialData?.data?.product
    const aisle = product?.location?.aisle ?? product?.store?.aisle ?? null
    if (aisle) return `Aisle ${aisle}`

    const m = fetched.html.match(/[Aa]isle\s+([A-Za-z0-9]{1,4})\b/)
    return m ? `Aisle ${m[1]}` : null
  } catch {
    return null
  }
}
