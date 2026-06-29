# ZimRent Backend

Full-stack property rental platform backend built with Node.js + Express + SQLite.

## Quick Start

```bash
cd server
npm install
cp .env.example .env   # or create .env manually
npm run migrate        # create database tables
npm start              # start server on http://localhost:3001
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Server port |
| `JWT_SECRET` | **Yes** | — | Secret for JWT signing |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiry |
| `UPLOAD_DIR` | No | `../uploads` | Image upload folder |
| `FRONTEND_URL` | No | `*` | CORS origin (use your domain in prod) |
| `ADMIN_EMAIL` | No | — | Auto-create admin if set |
| `ADMIN_PASSWORD` | No | `admin123` | Admin password |

## Scripts

- `npm start` — run server
- `npm run dev` — run with auto-reload
- `npm run migrate` — run database migrations

## Database

Uses `sql.js` (SQLite in browser/Node). The database file is created at `server/zimrent.db`.

### Schema

- `users` — accounts with role-based access
- `properties` — rental listings owned by a landlord
- `applications` — tenant applications for properties
- `favorites` — saved properties per user
- `messages` — direct messages between users
- `notifications` — in-app notifications

## API Overview

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/profile`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Properties
- `GET /api/properties?page=1&limit=20&city=Harare`
- `GET /api/properties/:id`
- `POST /api/properties` (landlord/admin)
- `PUT /api/properties/:id` (owner/admin)
- `DELETE /api/properties/:id` (owner/admin)
- `POST /api/properties/:id/images` (owner/admin)

### Applications
- `POST /api/applications` (tenant)
- `GET /api/applications/mine` (tenant)
- `GET /api/applications/landlord` (landlord/admin)
- `PUT /api/applications/:id/status` (landlord/admin)

### Favorites
- `GET /api/favorites`
- `POST /api/favorites`
- `DELETE /api/favorites/:id`

### Messages
- `POST /api/messages`
- `GET /api/messages`
- `GET /api/messages/conversation/:userId`
- `GET /api/messages/unread-count`

### Admin
- `GET /api/admin/users`
- `DELETE /api/admin/users/:id`
- `PUT /api/admin/users/:id/suspend`
- `GET /api/admin/properties`
- `DELETE /api/admin/properties/:id`
- `GET /api/admin/stats`

## Security

- Passwords hashed with bcrypt
- JWT authentication
- Role-based authorization (tenant / landlord / admin)
- Rate limiting on auth routes
- File upload restrictions (images only, max 5MB)

## Development

```bash
npm run dev
```

## Production Checklist

- [ ] Set strong `JWT_SECRET`
- [ ] Set `FRONTEND_URL` to your domain
- [ ] Set `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- [ ] Enable HTTPS
- [ ] Add email provider (SendGrid, SES, etc.)
- [ ] Add logging (Winston, Pino)
- [ ] Add monitoring