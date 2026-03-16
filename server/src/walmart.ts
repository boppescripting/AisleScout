import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

chromium.use(StealthPlugin())
console.log('[playwright] Stealth plugin registered')

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

// ─── Playwright (stealth Chromium) ───────────────────────────────────────────
// Runs a real Chromium instance with stealth patches applied, bypassing Akamai's
// bot detection (TLS fingerprint, JS challenges, navigator.webdriver, etc.).
// Falls back to plain Node.js fetch on dev machines where Chromium isn't installed.

// Rotate through realistic Chrome versions / screen sizes to avoid a fixed fingerprint
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
]
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
  { width: 1536, height: 864 },
]
const TIMEZONES = ['America/Chicago', 'America/New_York', 'America/Los_Angeles', 'America/Denver']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function jitter(minMs: number, maxMs: number): Promise<void> {
  return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)))
}

let _browser: any = null
let _requestCount = 0
const BROWSER_RECYCLE_AFTER = 8  // relaunch browser every N requests

async function getBrowser(): Promise<any> {
  if (_browser && _requestCount < BROWSER_RECYCLE_AFTER) return _browser
  if (_browser) {
    console.log('[playwright] Recycling browser after', _requestCount, 'requests')
    await _browser.close().catch(() => {})
    _browser = null
    _requestCount = 0
  }
  _browser = await chromium.launch({ headless: true })
  return _browser
}

// Serialise all Walmart requests — one at a time.
// Jitter is only added when a request is queued behind another (burst detection).
// Solo requests (normal item adds) fire immediately with no delay.
let _queue: Promise<any> = Promise.resolve()
let _pendingCount = 0

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const needsJitter = _pendingCount > 0
  _pendingCount++
  const next = _queue
    .then(() => needsJitter ? jitter(1500, 4000) : Promise.resolve())
    .then(fn)
    .finally(() => { _pendingCount-- })
  _queue = next.catch(() => {})
  return next
}

// Fetches one or two URLs in a single browser context (same session).
// The optional secondUrl is navigated to after the first, reusing the same
// page/cookies — used to fetch the store-specific product page for aisle data.
async function playwrightFetch(
  url: string,
  cookieHeader: string | undefined,
  timeoutMs: number,
  secondUrl?: string
): Promise<{ status: number; html: string; secondHtml?: string } | null> {
  return enqueue(async () => {
    let context: any = null
    try {
      const browser = await getBrowser()
      _requestCount++

      context = await browser.newContext({
        userAgent: pick(USER_AGENTS),
        locale: 'en-US',
        timezoneId: pick(TIMEZONES),
        viewport: pick(VIEWPORTS),
      })

      if (cookieHeader?.trim()) {
        const domain = new URL(url).hostname
        const cookies = cookieHeader.split(';')
          .map(pair => {
            const idx = pair.indexOf('=')
            if (idx < 0) return null
            return { name: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim(), domain, path: '/' }
          })
          .filter((c): c is NonNullable<typeof c> => c !== null && c.name.length > 0)
        if (cookies.length) await context.addCookies(cookies)
      }

      const page = await context.newPage()
      const response = await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' })
      const html = await page.content()

      // Navigate to the second URL in the same session if provided
      let secondHtml: string | undefined
      if (secondUrl) {
        try {
          await jitter(800, 1800)
          await page.goto(secondUrl, { timeout: timeoutMs, waitUntil: 'domcontentloaded' })
          secondHtml = await page.content()
        } catch {
          // aisle fetch failed — not fatal
        }
      }

      return { status: response?.status() ?? 200, html, secondHtml }
    } catch (err: any) {
      console.warn(`[playwright] ${err?.message?.slice(0, 120)}`)
      if (err?.message?.includes('Target closed') || err?.message?.includes('Browser closed')) {
        _browser = null
        _requestCount = 0
      }
      return null
    } finally {
      await context?.close().catch(() => {})
    }
  })
}

// ─── Node.js fetch fallback ───────────────────────────────────────────────────
// Used when Playwright/Chromium is not installed (local dev). Akamai will likely
// block this, but OFF + keyword fallbacks still provide department info.

async function nodeFetch(
  url: string,
  cookieHeader: string | undefined,
  timeoutMs: number
): Promise<{ status: number; html: string } | null> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  }
  if (cookieHeader?.trim()) headers['Cookie'] = cookieHeader.trim()

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers, signal: ctl.signal, redirect: 'follow' })
    clearTimeout(timer)
    return { status: res.status, html: await res.text() }
  } catch (err: any) {
    clearTimeout(timer)
    return null
  }
}

// ─── Unified fetch (Playwright > Node.js fetch) ───────────────────────────────

async function fetchPage(
  url: string,
  cookieHeader: string | undefined,
  timeoutSec = 15,
  secondUrl?: string
): Promise<{ status: number; html: string; method: string; secondHtml?: string } | null> {
  const pw = await playwrightFetch(url, cookieHeader, timeoutSec * 1000, secondUrl)
  if (pw) return { ...pw, method: 'playwright' }

  // Fallback for dev environments without Chromium installed
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

// Maps Walmart's catalogProductType values to our department names
const CATALOG_TYPE_DEPT: Record<string, string> = {
  'Eggs': 'Dairy & Eggs', 'Milk': 'Dairy & Eggs', 'Cheese': 'Dairy & Eggs',
  'Butter': 'Dairy & Eggs', 'Yogurt': 'Dairy & Eggs', 'Cream': 'Dairy & Eggs',
  'Coffee': 'Coffee', 'Tea': 'Tea',
  'Bread': 'Bakery & Bread', 'Bagels': 'Bakery & Bread', 'Tortillas': 'Bakery & Bread',
  'Chicken': 'Meat', 'Beef': 'Meat', 'Pork': 'Meat', 'Turkey': 'Meat',
  'Sausage': 'Meat', 'Bacon': 'Meat', 'Deli Meat': 'Meat', 'Hot Dogs': 'Meat',
  'Fish': 'Seafood', 'Seafood': 'Seafood', 'Shrimp': 'Seafood',
  'Ice Cream': 'Frozen Foods', 'Frozen Meals': 'Frozen Foods', 'Frozen Pizza': 'Frozen Foods',
  'Chips': 'Snacks & Candy', 'Crackers': 'Snacks & Candy', 'Popcorn': 'Snacks & Candy',
  'Candy': 'Snacks & Candy', 'Chocolate': 'Snacks & Candy', 'Gum': 'Snacks & Candy',
  'Cereal': 'Breakfast & Cereal', 'Oatmeal': 'Breakfast & Cereal', 'Granola': 'Breakfast & Cereal',
  'Pasta': 'Pasta & Grains', 'Rice': 'Pasta & Grains', 'Noodles': 'Pasta & Grains',
  'Soup': 'Canned Goods', 'Beans': 'Canned Goods', 'Canned Vegetables': 'Canned Goods',
  'Condiments': 'Condiments & Sauces', 'Sauces': 'Condiments & Sauces', 'Salad Dressing': 'Condiments & Sauces',
  'Cooking Oil': 'Cooking Oils', 'Olive Oil': 'Cooking Oils',
  'Baking': 'Baking', 'Flour': 'Baking', 'Sugar': 'Baking',
  'Spices': 'Spices & Seasonings', 'Seasonings': 'Spices & Seasonings',
  'Fresh Fruit': 'Produce', 'Fresh Vegetables': 'Produce', 'Salad': 'Produce',
  'Shampoo': 'Health & Beauty', 'Body Wash': 'Health & Beauty', 'Deodorant': 'Health & Beauty',
  'Vitamins': 'Vitamins & Supplements', 'Supplements': 'Vitamins & Supplements',
  'Medicine': 'Pharmacy', 'Pain Relief': 'Pharmacy', 'Cold & Flu': 'Pharmacy',
  'Laundry Detergent': 'Laundry', 'Fabric Softener': 'Laundry',
  'Cleaning': 'Household Cleaners', 'Disinfectants': 'Household Cleaners',
  'Paper Towels': 'Paper & Plastic', 'Toilet Paper': 'Paper & Plastic',
  'Diapers': 'Baby', 'Baby Food': 'Baby', 'Baby Formula': 'Baby',
  'Dog Food': 'Pet Supplies', 'Cat Food': 'Pet Supplies', 'Pet Treats': 'Pet Supplies',
  'Soda': 'Beverages', 'Juice': 'Beverages', 'Water': 'Beverages', 'Sports Drinks': 'Beverages',
  'Beer': 'Wine, Beer & Spirits', 'Wine': 'Wine, Beer & Spirits', 'Spirits': 'Wine, Beer & Spirits',
}

function parseProduct(p: Record<string, any>): Omit<WalmartProduct, 'source'> {
  const price =
    safeNum(p?.priceInfo?.currentPrice?.price) ??
    safeNum(p?.price) ??
    safeNum(p?.priceInfo?.price) ??
    null

  // category.path is often null in search results; use catalogProductType instead
  const categoryPath: any[] = Array.isArray(p?.category?.path) ? p.category.path : []
  const department =
    safeStr(categoryPath[0]?.name) ??
    (p?.catalogProductType ? CATALOG_TYPE_DEPT[p.catalogProductType] ?? null : null) ??
    safeStr(p?.department) ??
    null

  // productLocation comes from Walmart's planogram database which may reference a
  // different store than the one configured — treat as approximate.
  const loc = p?.productLocation?.[0]
  const aisleRaw =
    safeStr(loc?.displayValue) ??
    safeStr(p?.productLocationDisplayValue) ??
    null
  const aisle = aisleRaw ? `~${aisleRaw}` : null

  return {
    productName: safeStr(p?.name) ?? safeStr(p?.title),
    price,
    department,
    aisle,
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
    // We don't know the itemId yet, so fetch search page first.
    // Once we have the itemId, the store product page is fetched in the same session.
    const fetched = await fetchPage(url, cookieHeader, 25)
    if (!fetched) return null

    const title = extractPageTitle(fetched.html)
    console.log(`[Walmart] HTTP ${fetched.status} via ${fetched.method}, ${fetched.html.length} chars, title="${title}"`)

    if (fetched.status !== 200 || isBotPage(title)) {
      console.warn(`[Walmart] Bot challenge page via ${fetched.method} — try refreshing your Walmart cookie in Settings`)
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

    // Fetch store-specific product page in a second session to get correct aisle for store
    if (storeId && result.walmartItemId) {
      const productUrl = `https://www.walmart.com/store/${storeId}/product/${result.walmartItemId}`
      const productPage = await fetchPage(productUrl, cookieHeader, 15)
      if (productPage && productPage.status === 200 && !isBotPage(extractPageTitle(productPage.html))) {
        const productData = extractNextData(productPage.html)
        const p = (productData as any)?.props?.pageProps?.initialData?.data?.product
        const aisleVal =
          safeStr(p?.location?.displayValue) ??
          safeStr(p?.store?.location?.displayValue) ??
          safeStr(p?.location?.aisle) ??
          null
        if (aisleVal) result.aisle = `Aisle ${aisleVal}`
        console.log(`[Walmart] Store ${storeId} aisle="${result.aisle}"`)
      }
    }

    console.log(`[Walmart] "${result.productName}" $${result.price} dept="${result.department}" aisle="${result.aisle}"`)

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
    if (!fetched) { debug.error = 'All fetch methods failed (Playwright + Node.js)'; return debug }

    debug.fetchMethod = fetched.method
    debug.httpStatus = fetched.status
    debug.htmlLength = fetched.html.length
    debug.pageTitle = extractPageTitle(fetched.html)

    if (isBotPage(debug.pageTitle)) {
      debug.error = `Bot challenge via ${debug.fetchMethod} — try refreshing your Walmart cookie in Settings`
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
      debug.result = { ...parseProduct(items[0] as Record<string, any>), source: 'walmart' };
      (debug as any).rawItem = items[0]
    }
  } catch (err: any) {
    debug.error = err?.message ?? String(err)
  }

  return debug
}

