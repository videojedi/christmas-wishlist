const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const db = new Database(path.join(__dirname, 'wishlist.db'));
const JWT_SECRET = process.env.JWT_SECRET || 'christmas-secret-change-in-production';

// Word lists for generating memorable share tokens
const adjectives = [
  'happy', 'jolly', 'merry', 'festive', 'snowy', 'cozy', 'sparkly', 'magical',
  'frosty', 'cheerful', 'bright', 'golden', 'silver', 'twinkling', 'peaceful',
  'joyful', 'warm', 'gentle', 'dancing', 'glowing', 'sweet', 'lovely'
];
const nouns = [
  'snowflake', 'reindeer', 'penguin', 'snowman', 'candy', 'sleigh', 'star',
  'angel', 'bell', 'candle', 'cookie', 'gift', 'ribbon', 'wreath', 'mitten',
  'stocking', 'elf', 'carol', 'tinsel', 'gingerbread', 'cocoa', 'fireplace'
];

function generateShareToken() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}-${noun}-${num}`;
}

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Serve index.html for gifter route (SPA) with dynamic OG tags
app.get('/gift/:shareToken', (req, res) => {
  const wishlist = db.prepare('SELECT w.*, r.name as recipient_name FROM wishlists w JOIN recipients r ON w.recipient_id = r.id WHERE w.share_token = ?')
    .get(req.params.shareToken);

  // Read the index.html file
  const indexPath = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  // Build the full URL for OG image
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const baseUrl = `${protocol}://${host}`;

  // Replace OG image with full URL
  html = html.replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${baseUrl}/og-image.png">`);

  if (wishlist) {
    // Escape quotes for safe HTML attribute values
    const escapeAttr = (str) => str.replace(/"/g, '&quot;');

    const title = escapeAttr(`${wishlist.recipient_name}'s Christmas Wishlist`);
    const description = escapeAttr(`Help ${wishlist.recipient_name} have a wonderful Christmas! View their wishlist "${wishlist.title}" and claim a gift.`);

    // Replace default OG tags with dynamic ones
    html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${title}">`);
    html = html.replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${description}">`);
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  }

  res.send(html);
});

// Auth middleware for recipients
function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Check if a wishlist's end date has passed
function isPastEndDate(endDate) {
  const now = new Date();
  const end = new Date(endDate + 'T23:59:59');
  return now > end;
}

// ============ AUTH ROUTES ============

// Register a new recipient
app.post('/api/auth/register', async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Email, name, and password are required' });
  }

  const existing = db.prepare('SELECT id FROM recipients WHERE email = ?').get(email);
  if (existing) {
    console.log(`[AUTH] Registration failed - email already exists: ${email}`);
    return res.status(400).json({ error: 'Email already registered' });
  }

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);

  db.prepare('INSERT INTO recipients (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
    .run(id, email, name, passwordHash);

  console.log(`[AUTH] New user registered: ${name} (${email})`);

  const token = jwt.sign({ id, email, name }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ id, email, name });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM recipients WHERE email = ?').get(email);
  if (!user) {
    console.log(`[AUTH] Login failed - user not found: ${email}`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    console.log(`[AUTH] Login failed - wrong password: ${email}`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  console.log(`[AUTH] User logged in: ${user.name} (${email})`);

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ id: user.id, email: user.email, name: user.name });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// ============ WISHLIST ROUTES (Recipient) ============

// Get all wishlists for current user
app.get('/api/wishlists', authMiddleware, (req, res) => {
  const wishlists = db.prepare('SELECT * FROM wishlists WHERE recipient_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json(wishlists);
});

// Create a new wishlist
app.post('/api/wishlists', authMiddleware, (req, res) => {
  const { title, end_date } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const id = uuidv4();
  let shareToken = generateShareToken();

  // Ensure uniqueness (regenerate if collision)
  while (db.prepare('SELECT id FROM wishlists WHERE share_token = ?').get(shareToken)) {
    shareToken = generateShareToken();
  }

  const endDate = end_date || `${new Date().getFullYear()}-12-25`;

  db.prepare('INSERT INTO wishlists (id, recipient_id, title, share_token, end_date) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.user.id, title, shareToken, endDate);

  console.log(`[WISHLIST] Created: "${title}" by ${req.user.name} (token: ${shareToken})`);

  const wishlist = db.prepare('SELECT * FROM wishlists WHERE id = ?').get(id);
  res.json(wishlist);
});

// Get a single wishlist (recipient view - shows claims after end date)
app.get('/api/wishlists/:id', authMiddleware, (req, res) => {
  const wishlist = db.prepare('SELECT * FROM wishlists WHERE id = ? AND recipient_id = ?')
    .get(req.params.id, req.user.id);

  if (!wishlist) {
    return res.status(404).json({ error: 'Wishlist not found' });
  }

  const items = db.prepare('SELECT * FROM items WHERE wishlist_id = ? ORDER BY created_at')
    .all(wishlist.id);

  // Only show claims after the end date (or in preview mode)
  const pastEndDate = isPastEndDate(wishlist.end_date);
  const previewMode = req.query.preview === '1';
  const showClaims = pastEndDate || previewMode;

  const itemsWithClaims = items.map(item => {
    if (showClaims) {
      const claim = db.prepare(`
        SELECT c.*, g.name as gifter_name, g.email as gifter_email
        FROM claims c
        JOIN gifters g ON c.gifter_id = g.id
        WHERE c.item_id = ?
      `).get(item.id);
      return { ...item, claim: claim || null };
    }
    return { ...item, claim: null };
  });

  res.json({ ...wishlist, items: itemsWithClaims, past_end_date: pastEndDate });
});

// Update a wishlist
app.put('/api/wishlists/:id', authMiddleware, (req, res) => {
  const { title, end_date } = req.body;
  const wishlist = db.prepare('SELECT * FROM wishlists WHERE id = ? AND recipient_id = ?')
    .get(req.params.id, req.user.id);

  if (!wishlist) {
    return res.status(404).json({ error: 'Wishlist not found' });
  }

  db.prepare('UPDATE wishlists SET title = ?, end_date = ? WHERE id = ?')
    .run(title || wishlist.title, end_date || wishlist.end_date, wishlist.id);

  const updated = db.prepare('SELECT * FROM wishlists WHERE id = ?').get(wishlist.id);
  res.json(updated);
});

// Delete a wishlist
app.delete('/api/wishlists/:id', authMiddleware, (req, res) => {
  const wishlist = db.prepare('SELECT * FROM wishlists WHERE id = ? AND recipient_id = ?')
    .get(req.params.id, req.user.id);

  if (!wishlist) {
    return res.status(404).json({ error: 'Wishlist not found' });
  }

  db.prepare('DELETE FROM wishlists WHERE id = ?').run(wishlist.id);
  res.json({ message: 'Wishlist deleted' });
});

// ============ ITEM ROUTES (Recipient) ============

// Add item to wishlist
app.post('/api/wishlists/:wishlistId/items', authMiddleware, (req, res) => {
  const { name, description, link } = req.body;

  const wishlist = db.prepare('SELECT * FROM wishlists WHERE id = ? AND recipient_id = ?')
    .get(req.params.wishlistId, req.user.id);

  if (!wishlist) {
    return res.status(404).json({ error: 'Wishlist not found' });
  }

  if (!name) {
    return res.status(400).json({ error: 'Item name is required' });
  }

  const id = uuidv4();
  db.prepare('INSERT INTO items (id, wishlist_id, name, description, link) VALUES (?, ?, ?, ?, ?)')
    .run(id, wishlist.id, name, description || null, link || null);

  console.log(`[ITEM] Added: "${name}" to "${wishlist.title}" by ${req.user.name}`);

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json(item);
});

// Update an item
app.put('/api/items/:id', authMiddleware, (req, res) => {
  const { name, description, link } = req.body;

  const item = db.prepare(`
    SELECT i.* FROM items i
    JOIN wishlists w ON i.wishlist_id = w.id
    WHERE i.id = ? AND w.recipient_id = ?
  `).get(req.params.id, req.user.id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  db.prepare('UPDATE items SET name = ?, description = ?, link = ? WHERE id = ?')
    .run(name || item.name, description ?? item.description, link ?? item.link, item.id);

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(item.id);
  res.json(updated);
});

// Delete an item
app.delete('/api/items/:id', authMiddleware, (req, res) => {
  const item = db.prepare(`
    SELECT i.* FROM items i
    JOIN wishlists w ON i.wishlist_id = w.id
    WHERE i.id = ? AND w.recipient_id = ?
  `).get(req.params.id, req.user.id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
  res.json({ message: 'Item deleted' });
});

// ============ GIFTER ROUTES (Public via share token) ============

// Get wishlist by share token (gifter view)
app.get('/api/shared/:shareToken', (req, res) => {
  const wishlist = db.prepare('SELECT w.*, r.name as recipient_name FROM wishlists w JOIN recipients r ON w.recipient_id = r.id WHERE w.share_token = ?')
    .get(req.params.shareToken);

  if (!wishlist) {
    console.log(`[GIFTER] Wishlist not found: ${req.params.shareToken}`);
    return res.status(404).json({ error: 'Wishlist not found' });
  }

  // Check if the logged-in user is the wishlist owner (prevent spoilers!)
  const token = req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.id === wishlist.recipient_id) {
        console.log(`[GIFTER] Blocked owner from viewing own shared list: ${decoded.name}`);
        return res.status(403).json({ error: 'You cannot view your own wishlist as a gifter - no peeking at surprises!' });
      }
    } catch (err) {
      // Invalid token, proceed as anonymous gifter
    }
  }

  console.log(`[GIFTER] Viewing wishlist: "${wishlist.title}" for ${wishlist.recipient_name}`);

  const pastEndDate = isPastEndDate(wishlist.end_date);

  // Get all items with claim info
  const allItems = db.prepare('SELECT * FROM items WHERE wishlist_id = ? ORDER BY created_at')
    .all(wishlist.id);

  // Get claims with gifter info for all items
  const itemsWithClaims = allItems.map(item => {
    const claim = db.prepare(`
      SELECT c.*, g.name as gifter_name, g.email as gifter_email
      FROM claims c
      JOIN gifters g ON c.gifter_id = g.id
      WHERE c.item_id = ?
    `).get(item.id);

    if (claim) {
      return {
        ...item,
        claimed: true,
        claimed_by_name: claim.gifter_name,
        claimed_by_email: claim.gifter_email || null
      };
    }
    return { ...item, claimed: false };
  });

  const claimedCount = itemsWithClaims.filter(i => i.claimed).length;

  res.json({
    id: wishlist.id,
    title: wishlist.title,
    recipient_name: wishlist.recipient_name,
    end_date: wishlist.end_date,
    past_end_date: pastEndDate,
    items: pastEndDate ? [] : itemsWithClaims,
    total_items: allItems.length,
    claimed_count: claimedCount
  });
});

// Check if an item is still available (for race condition prevention)
app.get('/api/shared/:shareToken/check/:itemId', (req, res) => {
  const wishlist = db.prepare('SELECT * FROM wishlists WHERE share_token = ?')
    .get(req.params.shareToken);

  if (!wishlist) {
    return res.status(404).json({ error: 'Wishlist not found' });
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ? AND wishlist_id = ?')
    .get(req.params.itemId, wishlist.id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const existingClaim = db.prepare('SELECT * FROM claims WHERE item_id = ?').get(item.id);

  res.json({ available: !existingClaim });
});

// Claim an item as a gifter
app.post('/api/shared/:shareToken/claim/:itemId', (req, res) => {
  const { gifter_name, gifter_email } = req.body;

  if (!gifter_name) {
    return res.status(400).json({ error: 'Your name is required' });
  }

  const wishlist = db.prepare('SELECT * FROM wishlists WHERE share_token = ?')
    .get(req.params.shareToken);

  if (!wishlist) {
    return res.status(404).json({ error: 'Wishlist not found' });
  }

  if (isPastEndDate(wishlist.end_date)) {
    return res.status(400).json({ error: 'This wishlist has expired' });
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ? AND wishlist_id = ?')
    .get(req.params.itemId, wishlist.id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  // Check if already claimed
  const existingClaim = db.prepare('SELECT * FROM claims WHERE item_id = ?').get(item.id);
  if (existingClaim) {
    return res.status(400).json({ error: 'This item has already been claimed' });
  }

  // Create or find gifter
  let gifter = db.prepare('SELECT * FROM gifters WHERE name = ? AND email = ?')
    .get(gifter_name, gifter_email || null);

  if (!gifter) {
    const gifterId = uuidv4();
    db.prepare('INSERT INTO gifters (id, name, email) VALUES (?, ?, ?)')
      .run(gifterId, gifter_name, gifter_email || null);
    gifter = { id: gifterId, name: gifter_name, email: gifter_email };
  }

  // Create claim
  const claimId = uuidv4();
  db.prepare('INSERT INTO claims (id, item_id, gifter_id) VALUES (?, ?, ?)')
    .run(claimId, item.id, gifter.id);

  // Get item name for logging
  const itemForLog = db.prepare('SELECT i.name as item_name, w.title as wishlist_title, r.name as recipient_name FROM items i JOIN wishlists w ON i.wishlist_id = w.id JOIN recipients r ON w.recipient_id = r.id WHERE i.id = ?').get(item.id);
  console.log(`[CLAIM] ${gifter_name} claimed "${itemForLog.item_name}" from "${itemForLog.wishlist_title}" (for ${itemForLog.recipient_name})`);

  res.json({ message: 'Item claimed successfully!' });
});

// ============ THANK YOU LIST (Recipient - after end date) ============

app.get('/api/wishlists/:id/thankyou', authMiddleware, (req, res) => {
  const wishlist = db.prepare('SELECT * FROM wishlists WHERE id = ? AND recipient_id = ?')
    .get(req.params.id, req.user.id);

  if (!wishlist) {
    return res.status(404).json({ error: 'Wishlist not found' });
  }

  const previewMode = req.query.preview === '1';
  if (!isPastEndDate(wishlist.end_date) && !previewMode) {
    return res.status(400).json({ error: 'Thank you list not available until after ' + wishlist.end_date });
  }

  const claimedItems = db.prepare(`
    SELECT i.name as item_name, i.description, g.name as gifter_name, g.email as gifter_email, c.claimed_at
    FROM claims c
    JOIN items i ON c.item_id = i.id
    JOIN gifters g ON c.gifter_id = g.id
    WHERE i.wishlist_id = ?
    ORDER BY g.name, c.claimed_at
  `).all(wishlist.id);

  // Group by gifter
  const byGifter = {};
  claimedItems.forEach(item => {
    const key = item.gifter_name + (item.gifter_email ? ` (${item.gifter_email})` : '');
    if (!byGifter[key]) {
      byGifter[key] = [];
    }
    byGifter[key].push({
      item_name: item.item_name,
      description: item.description,
      claimed_at: item.claimed_at
    });
  });

  res.json({
    wishlist_title: wishlist.title,
    end_date: wishlist.end_date,
    gifts: byGifter
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Christmas Wishlist server running on http://localhost:${PORT}`);
});
