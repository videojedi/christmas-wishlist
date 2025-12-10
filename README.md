# Christmas Wishlist

![Christmas Wishlist](public/og-image.png)

A web app for managing Christmas wish lists with gift coordination between recipients and gifters.

## Features

### For Recipients (logged-in users)
- Create multiple wishlists with custom titles and end dates
- Add items with names, descriptions, and optional links
- Share lists via memorable URLs (e.g., `/gift/jolly-penguin-42`)
- Cannot see which items are claimed until after the end date
- View "Thank You" list after the end date showing who got what

### For Gifters (no login required)
- Access wishlists via shared link
- See all available (unclaimed) items
- Claim items by entering name and optional email
- Claimed items disappear from the list for other gifters
- Gifter info saved in localStorage for convenience

## Setup

```bash
# Install dependencies
npm install

# Initialize the database
npm run init-db

# Start the server
npm start
```

The app will be available at `http://localhost:3001`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `JWT_SECRET` | Secret for JWT tokens | `christmas-secret-change-in-production` |

For production, set a secure `JWT_SECRET`:

```bash
JWT_SECRET=your-secure-secret-here npm start
```

## Project Structure

```
christmas-wishlist/
├── server.js           # Express server with API routes
├── public/
│   ├── index.html      # Single-page app HTML
│   ├── styles.css      # Styling (mobile-responsive)
│   └── app.js          # Frontend JavaScript
├── scripts/
│   └── init-db.js      # Database initialization
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Wishlists (authenticated)
- `GET /api/wishlists` - List all wishlists
- `POST /api/wishlists` - Create wishlist
- `GET /api/wishlists/:id` - Get wishlist with items
- `PUT /api/wishlists/:id` - Update wishlist
- `DELETE /api/wishlists/:id` - Delete wishlist
- `GET /api/wishlists/:id/thankyou` - Get thank you list (after end date)

### Items (authenticated)
- `POST /api/wishlists/:id/items` - Add item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item

### Gifter (public)
- `GET /api/shared/:shareToken` - Get wishlist by share token
- `POST /api/shared/:shareToken/claim/:itemId` - Claim an item

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **Auth**: JWT with httpOnly cookies, bcrypt
- **Frontend**: Vanilla JavaScript, CSS

## License

MIT

---

*...another incredible Video Walrus product*
