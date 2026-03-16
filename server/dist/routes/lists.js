"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
// GET /api/lists — all lists with summary stats
router.get('/', async (_req, res) => {
    try {
        const result = await db_1.db.execute(`
      SELECT
        l.id,
        l.name,
        l.created_at,
        l.updated_at,
        COUNT(i.id)                                                         AS item_count,
        SUM(CASE WHEN i.checked = 1 THEN 1 ELSE 0 END)                     AS checked_count,
        SUM(CASE WHEN i.price IS NOT NULL THEN i.price * i.quantity ELSE 0 END) AS estimated_total
      FROM shopping_lists l
      LEFT JOIN items i ON i.list_id = l.id
      GROUP BY l.id
      ORDER BY l.updated_at DESC
    `);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch lists' });
    }
});
// POST /api/lists — create list
router.post('/', async (req, res) => {
    const { name } = req.body;
    if (!name?.trim())
        return res.status(400).json({ error: 'name is required' });
    try {
        const result = await db_1.db.execute({
            sql: "INSERT INTO shopping_lists (name) VALUES (?) RETURNING *",
            args: [name.trim()]
        });
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create list' });
    }
});
// PUT /api/lists/:id — rename list
router.put('/:id', async (req, res) => {
    const { name } = req.body;
    const id = Number(req.params.id);
    if (!name?.trim())
        return res.status(400).json({ error: 'name is required' });
    try {
        const result = await db_1.db.execute({
            sql: "UPDATE shopping_lists SET name = ?, updated_at = datetime('now') WHERE id = ? RETURNING *",
            args: [name.trim(), id]
        });
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'List not found' });
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update list' });
    }
});
// DELETE /api/lists/:id — delete list (cascades to items)
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
        await db_1.db.execute({ sql: 'DELETE FROM shopping_lists WHERE id = ?', args: [id] });
        res.status(204).send();
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete list' });
    }
});
exports.default = router;
