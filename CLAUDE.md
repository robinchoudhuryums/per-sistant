# CLAUDE.md — Project Context for Claude Code

## Project Overview
Personal assistant tool for task management, email scheduling, and note-taking.
Companion app to **Perfin** (personal finance tracker) — same design system, cross-linked navigation.

## Architecture
- **Server**: `server.js` (Express, port 3001, bound to 0.0.0.0)
- **Database**: Neon PostgreSQL (schema in `db/`)
- **Email**: nodemailer (SMTP) with scheduled sending via node-cron
- **AI**: Anthropic Claude API for email drafting (optional)
- **Tests**: `tests/` (node:test runner, run with `npm test`, 57 tests)
- **Deployment**: `Dockerfile`, `fly.toml` (Fly.io), `render.yaml` (Render)

## Current State (as of March 2026)
- Full Express server with inline HTML (matches Perfin aesthetic exactly)
- **Authentication**: Set `SESSION_PASSWORD` (text) or `SESSION_PIN` (numeric PIN pad) env var
- **Dark/Light theme**: Toggle in Settings, persisted to DB + localStorage
- **To-Do Lists**: Short/medium/long-term horizons, 4 priority levels, categories, due dates
- **Recurring Tasks**: Daily, weekly, monthly, yearly, weekdays recurrence rules with auto-generation
- **Subtasks**: Checklists within tasks with progress tracking
- **Natural Language Quick Add**: Create todos from natural language with auto-detected priority/horizon/due date
- **Email Drafting**: Compose, schedule, send; natural language "Quick Send" parser
- **AI Email Drafting**: Claude-powered email composition (requires `ANTHROPIC_API_KEY`)
- **Email Templates**: Save and reuse common email formats
- **Notes**: Color-coded, pinnable, with optional reminders
- **Contacts**: Name→email lookup for quick email addressing
- **Dashboard**: Overview cards, upcoming tasks, scheduled emails, Perfin integration widget
- **Global Search**: Search across todos, emails, and notes
- **Calendar View**: Monthly calendar showing tasks, emails, and notes by date
- **Weekly Review**: Stats summary of completed tasks, emails sent, notes created
- **Keyboard Shortcuts**: Global shortcuts (n=new todo, e=new email, /=search, etc.)
- **Drag-and-Drop**: Reorder todos by dragging
- **Browser Notifications**: Optional notification permission for reminders
- **PWA**: Installable as home screen app
- **Auto-migration**: Server runs all DB migrations on startup
- **Perfin Integration**: Dashboard widget showing subscription data, cross-link navigation

## Key Files
- `.env` — all secrets (never commit)
- `.env.example` — template with setup instructions
- `server.js` — main server (all routes + inline HTML)
- `db/001_schema.sql` — database schema (todos, emails, notes, contacts, settings)
- `db/002_features.sql` — enhancement migration (recurring, subtasks, templates, reviews)
- `tests/api.test.js` — test suite (57 tests, 16 suites)
- `Dockerfile` / `docker-compose.yml` — container deployment
- `fly.toml` — Fly.io config
- `render.yaml` — Render blueprint

## Commands
```bash
# Install & run locally
npm install && node server.js

# Run tests (57 tests)
npm test

# Pages
GET  /                     # Dashboard
GET  /todos                # To-do list page
GET  /emails               # Email management page
GET  /notes                # Notes page
GET  /contacts             # Contact management page
GET  /settings             # Settings page
GET  /calendar             # Calendar view
GET  /review               # Weekly review page
GET  /login                # Authentication

# Core API
GET    /api/todos           # List todos (query: horizon, priority, completed, category)
POST   /api/todos           # Create todo
PATCH  /api/todos/:id       # Update todo
DELETE /api/todos/:id       # Delete todo
POST   /api/todos/reorder   # Reorder todos (drag-and-drop)
POST   /api/todos/:id/complete-recurring  # Complete recurring task & generate next

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

# Enhancement API
GET    /api/subtasks/:todoId       # List subtasks for a todo
POST   /api/subtasks/:todoId       # Create subtask
PATCH  /api/subtasks/:id           # Update subtask
DELETE /api/subtasks/:id           # Delete subtask

GET    /api/email-templates        # List email templates
POST   /api/email-templates        # Create template
PUT    /api/email-templates/:id    # Update template
DELETE /api/email-templates/:id    # Delete template

POST   /api/ai/draft-email         # AI-powered email drafting
GET    /api/search                 # Global search (query: q)
GET    /api/calendar/:year/:month  # Calendar events for month
GET    /api/review                 # Weekly review stats
GET    /api/perfin/subscriptions   # Proxy to Perfin API

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
- `ANTHROPIC_API_KEY` — Claude API key for AI email drafting (optional)
- `PERFIN_URL` — URL to linked Perfin instance (for navigation + dashboard integration)

## Database
- Auto-migration runs on server startup — no manual SQL execution needed
- `user_settings` table: single-row pattern (CHECK id = 1)
- Tables: `todos`, `emails`, `notes`, `contacts`, `user_settings`, `subtasks`, `email_templates`, `weekly_reviews`

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
- Dashboard widget shows Perfin subscription data when `PERFIN_URL` is set

## Git
- Default branch: `claude/personal-assistant-tool-KdEYQ`
