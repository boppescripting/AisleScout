"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
// GET /api/settings
router.get('/', async (_req, res) => {
    try {
        const result = await db_1.db.execute('SELECT key, value FROM settings');
        const settings = {};
        for (const row of result.rows) {
            settings[row.key] = row.value ?? '';
        }
        res.json(settings);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});
// PUT /api/settings/:key
router.put('/:key', async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    try {
        await db_1.db.execute({
            sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            args: [key, value ?? '']
        });
        res.json({ key, value: value ?? '' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update setting' });
    }
});
exports.default = router;
