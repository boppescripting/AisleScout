import { createClient } from '@libsql/client'
import fs from 'fs'
import path from 'path'

// Ensure the data directory exists before opening the DB
const dbUrl = process.env.LIBSQL_URL || `file:${path.resolve(__dirname, '../../data/aisles.db')}`
if (dbUrl.startsWith('file:')) {
  const dbPath = dbUrl.replace(/^file:\/\//, '/').replace(/^file:/, '')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
}

export const db = createClient({ url: dbUrl })

export async function initDb() {
  await db.executeMultiple(`
    PRAGMA journal_mode=WAL;

    CREATE TABLE IF NOT EXISTS shopping_lists (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id          INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
      name             TEXT NOT NULL,
      quantity         INTEGER NOT NULL DEFAULT 1,
      checked          INTEGER NOT NULL DEFAULT 0,
      price            REAL,
      department       TEXT,
      aisle            TEXT,
      walmart_item_id  TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS walmart_cache (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key        TEXT NOT NULL UNIQUE,
      product_name     TEXT,
      price            REAL,
      department       TEXT,
      aisle            TEXT,
      walmart_item_id  TEXT,
      cached_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS user_aisles (
      walmart_item_id  TEXT PRIMARY KEY,
      aisle            TEXT NOT NULL,
      updated_at       TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('store_id', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('walmart_cookie', '');
  `)

  // Migrations
  const cacheCols = await db.execute("PRAGMA table_info(walmart_cache)")
  const cacheColNames = cacheCols.rows.map((r: any) => r.name)
  if (!cacheColNames.includes('source')) {
    await db.execute("ALTER TABLE walmart_cache ADD COLUMN source TEXT")
  }

  console.log('Database initialized')
}
