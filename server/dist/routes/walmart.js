"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const walmart_1 = require("../walmart");
const router = (0, express_1.Router)();
async function getSettings() {
    const rows = await db_1.db.execute("SELECT key, value FROM settings WHERE key IN ('store_id', 'walmart_cookie')");
    const map = {};
    for (const r of rows.rows)
        map[r.key] = r.value ?? '';
    return {
        storeId: map['store_id'] || undefined,
        cookieHeader: map['walmart_cookie'] || undefined,
    };
}
function cap(promise, ms) {
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(null), ms)),
    ]);
}
// Merge results from multiple sources. Walmart wins (has price), then OFF, then keyword.
function mergeResults(walmart, off, keyword) {
    // Use Walmart if it returned anything useful
    if (walmart?.price != null || (walmart?.department && !off && !keyword))
        return walmart;
    // OFF or keyword for department when Walmart fails
    const deptSource = off?.department ? off : keyword?.department ? keyword : null;
    if (!walmart && !deptSource)
        return null;
    // Combine: take price from Walmart (if any), department from best available
    return {
        productName: walmart?.productName ?? off?.productName ?? null,
        price: walmart?.price ?? null,
        department: walmart?.department ?? deptSource?.department ?? null,
        aisle: walmart?.aisle ?? null,
        walmartItemId: walmart?.walmartItemId ?? null,
        source: walmart?.price != null ? 'walmart' : off?.department ? 'openfoodfacts' : 'keyword',
    };
}
// GET /api/walmart/search?q=maple+pecan+k-cup
router.get('/search', async (req, res) => {
    const query = req.query.q?.trim();
    if (!query)
        return res.status(400).json({ error: 'q is required' });
    try {
        const { storeId, cookieHeader } = await getSettings();
        const cacheKey = `${query.toLowerCase()}:${storeId || ''}`;
        const cached = await db_1.db.execute({
            sql: `SELECT * FROM walmart_cache
            WHERE cache_key = ?
              AND datetime(cached_at) > datetime('now', '-24 hours')`,
            args: [cacheKey]
        });
        if (cached.rows.length > 0) {
            const r = cached.rows[0];
            return res.json({
                productName: r.product_name, price: r.price, department: r.department,
                aisle: r.aisle, walmartItemId: r.walmart_item_id,
                source: r.source ?? null, fromCache: true,
            });
        }
        // Run all three sources in parallel:
        //   - Walmart:  capped at 6s (fast-fails on bot challenge ~2s)
        //   - OFF:      capped at 5s
        //   - Keyword:  instant, no network
        const keywordDept = (0, walmart_1.guessDepartmentByKeyword)(query);
        const keywordResult = keywordDept
            ? { productName: null, price: null, department: keywordDept, aisle: null, walmartItemId: null, source: 'keyword' }
            : null;
        const [walmart, off] = await Promise.all([
            cap((0, walmart_1.searchWalmart)(query, storeId, cookieHeader), 6000),
            cap((0, walmart_1.searchOpenFoodFacts)(query), 5000),
        ]);
        console.log(`[Lookup] walmart=${walmart ? `$${walmart.price} / ${walmart.department}` : 'null'} off=${off?.department ?? 'null'} keyword=${keywordDept ?? 'null'}`);
        const result = mergeResults(walmart, off, keywordResult);
        if (result) {
            await db_1.db.execute({
                sql: `INSERT OR REPLACE INTO walmart_cache
                (cache_key, product_name, price, department, aisle, walmart_item_id, source, cached_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                args: [cacheKey, result.productName, result.price, result.department,
                    result.aisle, result.walmartItemId, result.source]
            });
        }
        res.json({ ...(result ?? {}), fromCache: false });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lookup failed' });
    }
});
// GET /api/walmart/debug?q=maple+pecan+k-cup
router.get('/debug', async (req, res) => {
    const query = req.query.q?.trim();
    if (!query)
        return res.status(400).json({ error: 'q is required' });
    const { storeId, cookieHeader } = await getSettings();
    res.json(await (0, walmart_1.debugSearch)(query, storeId, cookieHeader));
});
exports.default = router;
