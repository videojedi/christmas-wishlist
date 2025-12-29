const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'wishlist.db');
const db = new Database(dbPath);

db.exec(`
  -- Recipients (users who create wishlists)
  CREATE TABLE IF NOT EXISTS recipients (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Wishlists
  CREATE TABLE IF NOT EXISTS wishlists (
    id TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL,
    title TEXT NOT NULL,
    share_token TEXT UNIQUE NOT NULL,
    end_date TEXT NOT NULL DEFAULT '2025-12-25',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (recipient_id) REFERENCES recipients(id)
  );

  -- Wishlist items
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    wishlist_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    link TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE
  );

  -- Gifters (people who claim items)
  CREATE TABLE IF NOT EXISTS gifters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Claims (which gifter claimed which item)
  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL UNIQUE,
    gifter_id TEXT NOT NULL,
    claimed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (gifter_id) REFERENCES gifters(id)
  );
`);

console.log('Database initialized successfully!');
db.close();
