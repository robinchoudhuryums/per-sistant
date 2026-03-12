# Per-sistant

Personal assistant tool for task management, email scheduling, and note-taking. Companion app to **[Perfin](https://github.com/robinchoudhuryums/pers-fin)** (personal finance tracker) — same design system, cross-linked navigation.

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Browser (PWA)  │────>│  Express Server  │────>│  Claude API      │
│  Tasks / Emails  │     │  (port 3001)     │     │  (7 AI features) │
│  Notes / Calendar│     └────────┬─────────┘     └──────────────────┘
└──────────────────┘              │
                        ┌────────┴────────┐
                        │ Neon PostgreSQL  │
                        │  (todos, emails, │
                        │   notes, etc.)   │
                        └────────┬────────┘
                                 │
                        ┌────────┴────────┐     ┌──────────────┐
                        │    node-cron    │────>│  SMTP Server │
                        │ (email + tasks) │     │  (Gmail etc) │
                        └─────────────────┘     └──────────────┘
```

## Features

### To-Do Lists
- **Three horizons**: Short-term, medium-term, long-term
- **Four priorities**: Low, medium, high, urgent
- **Categories**: Preset categories (work, personal, health, finance, errands, home, learning) + custom categories with dropdown selector
- **Due dates**: With overdue detection and visual indicators
- **Filters**: By horizon, status (pending/completed), priority, and category
- **Drag-and-drop**: Reorder tasks by dragging
- **Natural language Quick Add**: Type "Buy groceries tomorrow urgent" and it auto-detects priority, horizon, and due date (AI-enhanced when enabled)

### Recurring Tasks
- **Five recurrence rules**: Daily, weekly, monthly, yearly, weekdays
- **Auto-generation**: When a recurring task is completed, the next instance is automatically created
- **Daily processor**: Cron job at midnight handles overdue recurring tasks

### Subtasks
- **Checklists**: Add subtasks within any todo
- **AI Task Breakdown**: Click "AI Breakdown" to auto-generate subtasks from a task title
- **Progress tracking**: Visual progress bar showing completion percentage
- **Inline management**: Add, check off, and delete subtasks without leaving the todo view

### Email Drafting & Scheduling
- **Compose**: Full email editor with recipient, subject, body
- **Schedule**: Set a specific date/time for automatic sending
- **Quick Send**: Natural language input — *"Send an email to Mom Tuesday morning at 9AM about dinner plans"*
- **AI Drafting**: Claude-powered email composition — describe what you want and AI writes the email
- **AI Tone Adjustment**: One-click rewrite — make any email more formal, casual, shorter, friendlier, or more direct
- **Email Templates**: Save and reuse common email formats
- **Contact lookup**: Type a name, auto-fills the email address
- **SMTP**: Sends via any SMTP provider (Gmail, Outlook, etc.)
- **Scheduler**: Checks every minute for due scheduled emails

### Notes
- **Quick notes**: Title + content, color-coded cards
- **Pin important notes**: Pinned notes stay at the top
- **Colors**: Default, warm, teal, green, blue
- **Tags**: Add tags manually or use AI auto-tagging to suggest tags based on content
- **Reminders**: Optional datetime reminders on notes

### Contacts
- **Name→email mapping**: For quick email addressing
- **Lookup API**: Used by email composer and Quick Send
- **Environment contacts**: Set `CONTACTS` env var for static contacts

### Dashboard
- **Overview cards**: Task counts, email stats, note totals
- **Task overview tabs**: All / By Category / By Urgency / Due Soon views
- **AI Daily Briefing**: AI-generated summary of your day's priorities and schedule
- **Upcoming tasks**: Next due items at a glance
- **Scheduled emails**: Pending sends
- **Global search**: Search across all todos, emails, and notes
- **Perfin widget**: Shows subscription data from linked Perfin instance

### Calendar View
- **Monthly calendar**: Visual overview of all events
- **Color-coded**: Tasks, emails, and notes shown with distinct colors
- **Navigate**: Browse months with previous/next controls

### Weekly Review
- **Stats cards**: Tasks completed, created, emails sent, notes added
- **AI Weekly Summary**: AI-generated narrative of your week's accomplishments and what needs attention
- **Completed tasks list**: What you accomplished this week
- **Overdue items**: Tasks needing attention
- **Upcoming**: What's coming next week

### AI Features (7 total)
All AI features are optional and independently configurable. Choose **Haiku** (fast, ~$0.0003/call), **Sonnet** (smarter, ~$0.002/call), or **Off** for each feature in Settings.

| Feature | Description | Default |
|---------|-------------|---------|
| Email Drafting | Compose emails from a prompt | Haiku |
| Task Breakdown | Auto-generate subtasks from task title | Haiku |
| Smart Quick Add | AI-parse natural language into structured tasks | Off |
| Weekly Review Summary | Narrative summary of your week | Haiku |
| Email Tone Adjustment | Rewrite emails (formal/casual/shorter/etc.) | Haiku |
| Daily Briefing | Dashboard summary of today's priorities | Off |
| Note Auto-Tagging | Suggest tags for notes based on content | Off |

### Authentication
Two login modes — set one in your environment variables:
- **`SESSION_PASSWORD`** — text password, shows a standard password input
- **`SESSION_PIN`** — numeric PIN, shows a PIN pad with dot indicators

Sessions expire after a configurable timeout (default 15 minutes, adjustable in Settings).

### Dark/Light Theme
Toggle between Night Mode (default) and Day Mode in Settings. Identical to Perfin's theme system.

### Keyboard Shortcuts
- **n** — New todo
- **e** — New email
- **/** — Focus search
- **t** — Go to Todos
- **d** — Go to Dashboard
- **?** — Show shortcuts reference (in Settings)

### Browser Notifications
Optional push notifications for task reminders. Enable in Settings.

### Perfin Integration
- Set `PERFIN_URL` to add a **Perfin** link in the navigation bar
- Dashboard widget shows subscription data from Perfin
- Both apps share the same design language and color palette

### Mobile App (PWA)
Installable as a home screen icon:
- **iPhone**: Open in Safari → Share → "Add to Home Screen"
- **Android**: Chrome → Menu → "Install app"

## Setup

### 1. Environment

```bash
cp .env.example .env
# Fill in your Neon DB URL, auth, and SMTP credentials
```

### 2. Run Locally

```bash
npm install && node server.js
# Open http://localhost:3001
```

The server runs **auto-migration on startup** — all required tables are created automatically.

### 3. Deployment

**Render (free):** See `render.yaml` — set env vars in dashboard.

**Fly.io (~$2/mo):**
```bash
fly launch --name per-sistant
fly secrets set NEON_DATABASE_URL="postgres://..."
fly secrets set SESSION_PASSWORD="..."
fly deploy
```

**Docker:**
```bash
docker compose up --build
```

## Running Tests

```bash
npm test
```

73 tests across 22 suites covering: time parsing, input validation, data structures, sorting, security, recurring tasks, subtasks, email templates, natural language parsing, global search, calendar, weekly review, drag-and-drop, keyboard shortcuts, AI model selection, AI task breakdown, AI tone adjustment, todo categories, note tags, and dashboard views.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Dashboard |
| `GET` | `/todos` | To-do list page |
| `GET` | `/emails` | Email management page |
| `GET` | `/notes` | Notes page |
| `GET` | `/contacts` | Contact management page |
| `GET` | `/settings` | Settings page |
| `GET` | `/calendar` | Calendar view |
| `GET` | `/review` | Weekly review page |
| `GET` | `/login` | Authentication |
| `GET` | `/api/todos` | List todos (query: horizon, priority, completed, category) |
| `POST` | `/api/todos` | Create todo |
| `PATCH` | `/api/todos/:id` | Update todo |
| `DELETE` | `/api/todos/:id` | Delete todo |
| `POST` | `/api/todos/reorder` | Reorder todos (drag-and-drop) |
| `POST` | `/api/todos/:id/complete-recurring` | Complete recurring task & create next |
| `GET` | `/api/emails` | List emails (query: status) |
| `POST` | `/api/emails` | Create email |
| `PATCH` | `/api/emails/:id` | Update email |
| `DELETE` | `/api/emails/:id` | Delete email |
| `POST` | `/api/emails/:id/send` | Send email now |
| `GET` | `/api/notes` | List notes |
| `POST` | `/api/notes` | Create note |
| `PATCH` | `/api/notes/:id` | Update note |
| `DELETE` | `/api/notes/:id` | Delete note |
| `GET` | `/api/contacts` | List contacts |
| `POST` | `/api/contacts` | Add contact |
| `PATCH` | `/api/contacts/:id` | Update contact |
| `DELETE` | `/api/contacts/:id` | Delete contact |
| `GET` | `/api/contacts/lookup/:name` | Lookup contact by name |
| `GET` | `/api/settings` | Get settings |
| `PATCH` | `/api/settings` | Update settings |
| `GET` | `/api/stats` | Dashboard statistics |
| `GET` | `/api/subtasks/:todoId` | List subtasks for a todo |
| `POST` | `/api/subtasks/:todoId` | Create subtask |
| `PATCH` | `/api/subtasks/:id` | Update subtask |
| `DELETE` | `/api/subtasks/:id` | Delete subtask |
| `GET` | `/api/email-templates` | List email templates |
| `POST` | `/api/email-templates` | Create template |
| `PUT` | `/api/email-templates/:id` | Update template |
| `DELETE` | `/api/email-templates/:id` | Delete template |
| `GET` | `/api/todo-categories` | List all categories (defaults + custom) |
| `POST` | `/api/ai/draft-email` | AI-powered email drafting |
| `POST` | `/api/ai/task-breakdown` | Generate subtasks from task title |
| `POST` | `/api/ai/parse-todo` | Parse natural language into structured todo |
| `POST` | `/api/ai/review-summary` | Generate weekly review narrative |
| `POST` | `/api/ai/adjust-tone` | Rewrite email in different tone |
| `GET` | `/api/ai/daily-briefing` | Generate daily task briefing |
| `POST` | `/api/ai/suggest-tags` | Suggest tags for note content |
| `GET` | `/api/ai/models` | Get per-feature model preferences |
| `PATCH` | `/api/ai/models` | Update per-feature model preferences |
| `GET` | `/api/search` | Global search (query: q) |
| `GET` | `/api/calendar` | Calendar events (query: month, year) |
| `GET` | `/api/review` | Weekly review stats |
| `GET` | `/api/perfin/stats` | Proxy to Perfin API |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEON_DATABASE_URL` | Neon PostgreSQL connection string |
| `SESSION_PASSWORD` | Text password for login (optional) |
| `SESSION_PIN` | Numeric PIN for PIN pad login (optional) |
| `SESSION_SECRET` | Session cookie secret (auto-generated if not set) |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | From email address |
| `CONTACTS` | JSON map of name→email |
| `ANTHROPIC_API_KEY` | Claude API key for AI email drafting (optional) |
| `PERFIN_URL` | URL to linked Perfin instance |
