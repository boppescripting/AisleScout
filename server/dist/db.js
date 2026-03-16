"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.initDb = initDb;
const client_1 = require("@libsql/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Ensure the data directory exists before opening the DB
const dbUrl = process.env.LIBSQL_URL || `file:${path_1.default.resolve(__dirname, '../../data/aisles.db')}`;
if (dbUrl.startsWith('file:')) {
    const dbPath = dbUrl.replace(/^file:\/\//, '/').replace(/^file:/, '');
    fs_1.default.mkdirSync(path_1.default.dirname(dbPath), { recursive: true });
}
exports.db = (0, client_1.createClient)({ url: dbUrl });
async function initDb() {
    await exports.db.executeMultiple(`
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

    INSERT OR IGNORE INTO settings (key, value) VALUES ('store_id', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('walmart_cookie', '');
  `);
    // Migrations
    const cacheCols = await exports.db.execute("PRAGMA table_info(walmart_cache)");
    const cacheColNames = cacheCols.rows.map((r) => r.name);
    if (!cacheColNames.includes('source')) {
        await exports.db.execute("ALTER TABLE walmart_cache ADD COLUMN source TEXT");
    }
    console.log('Database initialized');
}
