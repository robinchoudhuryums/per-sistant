# CLAUDE.md — Project Context for Claude Code

## Project Overview
Personal assistant tool for task management, email scheduling, and note-taking.
Companion app to **Perfin** (personal finance tracker) — same design system, cross-linked navigation.

## Architecture
- **Server**: `server.js` (Express, port 3001, bound to 0.0.0.0)
- **Database**: Neon PostgreSQL (schema in `db/`)
- **Email**: nodemailer (SMTP) with scheduled sending via node-cron
- **Tests**: `tests/` (node:test runner, run with `npm test`, 28 tests)
- **Deployment**: `Dockerfile`, `fly.toml` (Fly.io), `render.yaml` (Render)

## Current State (as of March 2026)
- Full Express server with inline HTML (matches Perfin aesthetic exactly)
- **Authentication**: Set `SESSION_PASSWORD` (text) or `SESSION_PIN` (numeric PIN pad) env var
- **Dark/Light theme**: Toggle in Settings, persisted to DB + localStorage
- **To-Do Lists**: Short/medium/long-term horizons, 4 priority levels, categories, due dates
- **Email Drafting**: Compose, schedule, send; natural language "Quick Send" parser
- **Notes**: Color-coded, pinnable, with optional reminders
- **Contacts**: Name→email lookup for quick email addressing
- **Dashboard**: Overview cards, upcoming tasks, scheduled emails
- **PWA**: Installable as home screen app
- **Auto-migration**: Server runs all DB migrations on startup
- **Perfin cross-link**: Navigation bar links to Perfin when `PERFIN_URL` is set

## Key Files
- `.env` — all secrets (never commit)
- `.env.example` — template with setup instructions
- `server.js` — main server (all routes + inline HTML)
- `db/001_schema.sql` — database schema (todos, emails, notes, contacts, settings)
- `tests/api.test.js` — test suite (28 tests)
- `Dockerfile` / `docker-compose.yml` — container deployment
- `fly.toml` — Fly.io config
- `render.yaml` — Render blueprint

## Commands
```bash
# Install & run locally
npm install && node server.js

# Run tests (28 tests)
npm test

# Key API endpoints
GET  /                     # Dashboard
GET  /todos                # To-do list page
GET  /emails               # Email management page
GET  /notes                # Notes page
GET  /contacts             # Contact management page
GET  /settings             # Settings page
GET  /login                # Authentication

# API
GET    /api/todos           # List todos (query: horizon, priority, completed, category)
POST   /api/todos           # Create todo
PATCH  /api/todos/:id       # Update todo
DELETE /api/todos/:id       # Delete todo

GET    /api/emails          # List emails (query: status)
POST   /api/emails          # Create email (draft or scheduled)
PATCH  /api/emails/:id      # Update email
DELETE /api/emails/:id      # Delete email
POST   /api/emails/:id/send # Send email now

GET    /api/notes           # List notes
POST   /api/notes           # Create note
PATCH  /api/notes/:id       # Update note
DELETE /api/notes/:id       # Delete note

GET    /api/contacts        # List contacts
POST   /api/contacts        # Add contact
PATCH  /api/contacts/:id    # Update contact
DELETE /api/contacts/:id    # Delete contact
GET    /api/contacts/lookup/:name  # Lookup by name

GET    /api/settings        # Get settings
PATCH  /api/settings        # Update settings
GET    /api/stats           # Dashboard statistics

POST   /api/login           # Authenticate
POST   /api/logout          # End session
GET    /manifest.json       # PWA manifest
GET    /sw.js               # Service worker
```

## Environment Variables
- `NEON_DATABASE_URL` — Neon PostgreSQL connection string
- `SESSION_PASSWORD` — text password for login (optional)
- `SESSION_PIN` — numeric PIN for PIN pad login (optional)
- `SESSION_SECRET` — session cookie secret (auto-generated if not set)
- `SMTP_HOST` — SMTP server for sending emails
- `SMTP_PORT` — SMTP port (default 587)
- `SMTP_USER` — SMTP username
- `SMTP_PASS` — SMTP password
- `SMTP_FROM` — From email address
- `CONTACTS` — JSON map of name→email (e.g. `{"mom":"mom@email.com"}`)
- `PERFIN_URL` — URL to linked Perfin instance (for navigation cross-link)

## Database
- Auto-migration runs on server startup — no manual SQL execution needed
- `user_settings` table: single-row pattern (CHECK id = 1)
- Tables: `todos`, `emails`, `notes`, `contacts`, `user_settings`

## Design System (shared with Perfin)
- Font: Inter (300/400/500/600/700)
- Dark theme: `#080b12` bg, `#f0ebe3` text, warm palette (`#d4a574`, `#c8856c`)
- Light theme: `#f5f2ed` bg, `#1a1a2e` text
- Accent colors: warm, teal, green, red, yellow, blue
- Glassmorphism cards with backdrop-filter blur
- Radial gradient ambient lighting effects

## Companion App
- **Perfin**: Personal finance tracker (separate repo: `pers-fin`)
- Same design system, same deployment approach
- Cross-linked via navigation bar
- Can share same Neon database or use separate databases

## Git
- Default branch: `claude/personal-assistant-tool-KdEYQ`
