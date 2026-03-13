# CLAUDE.md — Project Context for Claude Code

## Project Overview
Personal assistant tool for task management, email scheduling, and note-taking.
Companion app to **Perfin** (personal finance tracker) — same design system, cross-linked navigation.

## Architecture
- **Server**: `server.js` (Express, port 3001, bound to 0.0.0.0)
- **Database**: Neon PostgreSQL (schema in `db/`)
- **Email**: nodemailer (SMTP) with scheduled sending via node-cron
- **AI**: Anthropic Claude API — 9 AI features with per-feature model selection (Haiku/Sonnet/Off)
- **Tests**: `tests/` (node:test runner, run with `npm test`, 115 tests)
- **Deployment**: `Dockerfile`, `fly.toml` (Fly.io), `render.yaml` (Render)

## Current State (as of March 2026)
- Full Express server with inline HTML (matches Perfin aesthetic exactly)
- **Authentication**: Set `SESSION_PASSWORD` (text) or `SESSION_PIN` (numeric PIN pad) env var
- **Dark/Light theme**: Toggle in Settings, persisted to DB + localStorage
- **To-Do Lists**: Short/medium/long-term horizons, 4 priority levels, categories, due dates
- **Todo Categories**: Preset categories (work, personal, health, finance, errands, home, learning) + custom; filterable on todos page and dashboard
- **Dashboard Task Views**: All / By Category / By Urgency / Due Soon tabs
- **Recurring Tasks**: Daily, weekly, monthly, yearly, weekdays recurrence rules with auto-generation and streak/habit tracking
- **Subtasks**: Checklists within tasks with progress tracking
- **Natural Language Quick Add**: Create todos from natural language with auto-detected priority/horizon/due date (AI-enhanced when enabled)
- **Email Drafting**: Compose, schedule, send; natural language "Quick Send" parser
- **AI Email Drafting**: Claude-powered email composition (requires `ANTHROPIC_API_KEY`)
- **AI Email Tone Adjustment**: Rewrite emails as formal/casual/shorter/friendlier/direct
- **AI Task Breakdown**: Auto-generate subtasks from task title/description
- **AI Daily Briefing**: Dashboard summary of your day's priorities
- **AI Weekly Review Summary**: Narrative summary of your week's accomplishments
- **AI Note Auto-Tagging**: Suggest tags for notes based on content
- **AI Model Selection**: Per-feature choice of Haiku (fast/cheap), Sonnet (smarter), or Off — configurable in Settings
- **Email Templates**: Save and reuse common email formats
- **Notes**: Color-coded, pinnable, with optional reminders, tags, and Markdown support (bold, italic, lists, checkboxes, links, quotes, headings)
- **Task Dependencies**: Blocking/blocked-by relationships between tasks with circular dependency prevention
- **Streak Tracking**: Recurring tasks track completion streaks (current + best) with on-time detection
- **Contacts**: Name→email lookup for quick email addressing
- **Dashboard**: Customizable widget layout (drag-to-reorder, show/hide widgets), overview cards, task views, AI briefing, smart suggestions, natural language AI query, scheduled emails, Perfin widget, global search
- **AI Smart Suggestions**: AI-powered productivity coaching based on task priorities, due dates, and streaks
- **AI Natural Language Query**: Ask questions about your data ("what did I do last week?", "how many tasks are overdue?")
- **Automations/Rules Engine**: Create trigger→action rules (e.g., "when task created with category=work, set priority=high"), configurable in Settings
- **File Attachments**: Upload files (up to 10MB) to tasks, emails, and notes via local storage
- **iCal Export**: Export tasks and scheduled emails as .ics file for Google Calendar, Outlook, etc.
- **Voice Input**: Web Speech API microphone button on Quick Add and notes (Chrome/Edge)
- **Location-Based Reminders**: Set location (name + coordinates + radius) on tasks, periodic geofence checking with browser notifications
- **Mobile-Optimized**: Bottom navigation bar, hamburger menu, swipe between pages, floating action button, horizontal-scroll filters, responsive layouts
- **Offline Support**: Service worker caches pages and API responses, queues mutations for sync when back online, offline banner indicator
- **Global Search**: Search across todos, emails, and notes
- **Calendar View**: Monthly calendar with iCal export, showing tasks, emails, and notes by date
- **Weekly Review**: Stats summary + AI narrative of completed tasks, emails sent, notes created
- **Keyboard Shortcuts**: Global shortcuts (n=new todo, e=new email, /=search, etc.)
- **Drag-and-Drop**: Reorder todos by dragging
- **Browser Notifications**: Optional notification permission for reminders
- **PWA**: Installable as home screen app
- **Auto-migration**: Server runs all DB migrations on startup
- **Perfin Integration**: Dashboard widget showing subscription data, cross-link navigation
- **Trash/Undo**: Soft-delete with undo toast, restore from Settings trash, 30-day retention
- **Dashboard Inline Actions**: Complete tasks and send emails directly from dashboard
- **Bulk Actions**: Multi-select mode on todos, emails, and notes for batch operations
- **System Theme Auto-Detection**: Auto option follows OS dark/light preference via prefers-color-scheme
- **Backend Validation**: Server-side enum validation for priority, horizon, recurrence rules, note colors, email format

## Key Files
- `.env` — all secrets (never commit)
- `.env.example` — template with setup instructions
- `server.js` — main server (all routes + inline HTML)
- `db/001_schema.sql` — database schema (todos, emails, notes, contacts, settings)
- `db/002_features.sql` — enhancement migration (recurring, subtasks, templates, reviews)
- `db/003_ai_features.sql` — AI model preferences & note tags migration
- `db/004_soft_delete.sql` — soft delete columns for trash/undo
- `db/005_dependencies_streaks_markdown.sql` — task dependencies, streak tracking, note format migration
- `db/006_dashboard_automations.sql` — dashboard layout, automations, attachments, location reminders
- `uploads/` — local file attachment storage
- `tests/api.test.js` — test suite (115 tests, 36 suites)
- `Dockerfile` / `docker-compose.yml` — container deployment
- `fly.toml` — Fly.io config
- `render.yaml` — Render blueprint

## Commands
```bash
# Install & run locally
npm install && node server.js

# Run tests (88 tests)
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
POST   /api/todos/:id/complete-recurring  # Complete recurring task & generate next (with streak tracking)
GET    /api/todo-categories  # List all categories (defaults + custom)
GET    /api/todos/:id/dependencies  # Get task dependencies (blocked_by + blocking)
POST   /api/todos/:id/dependencies  # Add dependency (depends_on_id)
DELETE /api/dependencies/:id         # Remove dependency
GET    /api/streaks                  # Get streak stats for recurring tasks

GET    /api/emails          # List emails (query: status)
POST   /api/emails          # Create email (draft or scheduled)
PATCH  /api/emails/:id      # Update email
DELETE /api/emails/:id      # Delete email
POST   /api/emails/:id/send # Send email now

GET    /api/notes           # List notes (includes tags, format)
POST   /api/notes           # Create note (with optional tags array, format: plain/markdown)
PATCH  /api/notes/:id       # Update note (including format)
DELETE /api/notes/:id       # Delete note

GET    /api/trash            # List all trashed items
POST   /api/trash/:type/:id/restore  # Restore item from trash
DELETE /api/trash/:type/:id  # Permanently delete trashed item
POST   /api/trash/empty      # Empty all trash

POST   /api/bulk/todos       # Bulk action on todos (complete, delete, set_priority, set_horizon)
POST   /api/bulk/emails      # Bulk action on emails (delete)
POST   /api/bulk/notes       # Bulk action on notes (delete)

GET    /api/contacts        # List contacts
POST   /api/contacts        # Add contact
PATCH  /api/contacts/:id    # Update contact
DELETE /api/contacts/:id    # Delete contact
GET    /api/contacts/lookup/:name  # Lookup by name

GET    /api/settings        # Get settings
PATCH  /api/settings        # Update settings (including dashboard_layout)
GET    /api/stats           # Dashboard statistics

# Automations API
GET    /api/automations            # List automation rules
POST   /api/automations            # Create automation rule
PATCH  /api/automations/:id        # Update automation rule
DELETE /api/automations/:id        # Delete automation rule

# Attachments API
GET    /api/attachments/:type/:id       # List attachments for entity
POST   /api/attachments/:type/:id       # Upload file attachment (multipart)
GET    /api/attachments/download/:id    # Download attachment
DELETE /api/attachments/:id             # Delete attachment

# Calendar Export
GET    /api/calendar.ics           # iCal export of tasks and scheduled emails

# Enhancement API
GET    /api/subtasks/:todoId       # List subtasks for a todo
POST   /api/subtasks/:todoId       # Create subtask
PATCH  /api/subtasks/:id           # Update subtask
DELETE /api/subtasks/:id           # Delete subtask

GET    /api/email-templates        # List email templates
POST   /api/email-templates        # Create template
PUT    /api/email-templates/:id    # Update template
DELETE /api/email-templates/:id    # Delete template

GET    /api/search                 # Global search (query: q)
GET    /api/calendar               # Calendar events (query: month, year)
GET    /api/review                 # Weekly review stats
GET    /api/perfin/stats           # Proxy to Perfin API

# AI API (each respects per-feature model selection)
POST   /api/ai/draft-email         # AI-powered email drafting
POST   /api/ai/task-breakdown      # Generate subtasks from task title
POST   /api/ai/parse-todo          # Parse natural language into structured todo
POST   /api/ai/review-summary      # Generate weekly review narrative
POST   /api/ai/adjust-tone         # Rewrite email in different tone
GET    /api/ai/daily-briefing      # Generate daily task briefing
POST   /api/ai/suggest-tags        # Suggest tags for note content
GET    /api/ai/smart-suggestions   # AI productivity coaching suggestions
POST   /api/ai/query               # Natural language query about your data
GET    /api/ai/models              # Get per-feature model preferences
PATCH  /api/ai/models              # Update per-feature model preferences

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
- `ANTHROPIC_API_KEY` — Claude API key for AI features (optional)
- `PERFIN_URL` — URL to linked Perfin instance (for navigation + dashboard integration)

## Database
- Auto-migration runs on server startup — no manual SQL execution needed
- `user_settings` table: single-row pattern (CHECK id = 1), includes ai_model_* columns
- Tables: `todos`, `emails`, `notes`, `contacts`, `user_settings`, `subtasks`, `email_templates`, `weekly_reviews`, `task_dependencies`, `automations`, `attachments`

## AI Features & Models
- 9 AI features, each independently configurable: Haiku (fast/cheap), Sonnet (smarter), or Off
- Models: `claude-haiku-4-5-20251001`, `claude-sonnet-4-6-20250415`
- Features: email drafting, task breakdown, smart quick add, weekly review summary, email tone adjustment, daily briefing, note auto-tagging, smart suggestions, natural language query
- Configuration stored in `user_settings` table (ai_model_* columns)
- Settings page provides per-feature dropdowns

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
