// ============================================================================
// Per-sistant — Personal Assistant Server
// ============================================================================
// Express server for personal task management, email scheduling, and notes.
// Designed as a companion to Perfin (personal finance tracker) with matching
// aesthetic and cross-linking navigation.
//
// Endpoints:
//   GET  /                    — Dashboard overview
//   GET  /todos               — To-do list management
//   GET  /emails              — Email drafting & scheduling
//   GET  /notes               — Quick notes & reminders
//   GET  /contacts            — Contact management
//   GET  /settings            — App settings
//   GET  /login               — Authentication
//
// Run with:  node server.js
// Requires:  .env file in repo root (see .env.example)
// ============================================================================

require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

let multer;
try { multer = require("multer"); } catch { multer = null; }

let nodemailer;
try { nodemailer = require("nodemailer"); } catch { nodemailer = null; }

let cron;
try { cron = require("node-cron"); } catch { cron = null; }

let Anthropic;
try {
  Anthropic = require("@anthropic-ai/sdk").default || require("@anthropic-ai/sdk");
} catch { Anthropic = null; }

// AI model mapping — always use latest versions
const AI_MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6-20250415",
};

// Validation constants
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];
const VALID_HORIZONS = ["short", "medium", "long"];
const VALID_RECURRENCE_RULES = ["daily", "weekly", "monthly", "yearly", "weekdays"];
const VALID_NOTE_COLORS = ["default", "warm", "teal", "green", "blue"];
const VALID_EMAIL_STATUSES = ["draft", "scheduled", "sent", "failed"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_AI_FEATURES = ["email_draft", "task_breakdown", "quick_add", "review_summary", "email_tone", "daily_briefing", "note_tagging"];

async function callAI(model, prompt, maxTokens = 1024) {
  if (!Anthropic || !process.env.ANTHROPIC_API_KEY) throw new Error("AI not configured");
  if (!AI_MODELS[model]) throw new Error("Invalid model: " + model);
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: AI_MODELS[model],
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content[0].text.trim();
}

async function getAIModelForFeature(feature) {
  if (!VALID_AI_FEATURES.includes(feature)) return "off";
  try {
    const r = await pool.query(`SELECT ai_model_${feature} as model FROM user_settings WHERE id = 1`);
    return r.rows[0]?.model || "off";
  } catch { return "off"; }
}

const SESSION_PASSWORD = process.env.SESSION_PASSWORD;
const SESSION_PIN = process.env.SESSION_PIN;
const AUTH_SECRET = SESSION_PASSWORD || SESSION_PIN || null;
const AUTH_MODE = SESSION_PIN ? "pin" : (SESSION_PASSWORD ? "password" : null);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const PERFIN_URL = process.env.PERFIN_URL || null;

// Contacts from env (name→email map)
let envContacts = {};
try { envContacts = JSON.parse(process.env.CONTACTS || "{}"); } catch { envContacts = {}; }

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: process.env.NEON_DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    const migrationsDir = path.join(__dirname, "db");
    if (!fs.existsSync(migrationsDir)) return;
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await client.query(sql);
    }
    console.log(`Migrations complete (${files.length} files)`);
  } catch (err) {
    console.error("Migration error:", err.message);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Session middleware
// ---------------------------------------------------------------------------
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
}));

function requireAuth(req, res, next) {
  if (!AUTH_SECRET) return next();
  if (["/login", "/api/login", "/manifest.json", "/sw.js"].includes(req.path)) return next();
  if (req.session && req.session.authenticated) {
    const timeout = (req.session.timeoutMinutes || 15) * 60 * 1000;
    if (Date.now() - req.session.lastActivity < timeout) {
      req.session.lastActivity = Date.now();
      return next();
    }
    req.session.authenticated = false;
  }
  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "Session expired. Please log in." });
  }
  return res.redirect("/login");
}
app.use(requireAuth);

// ---------------------------------------------------------------------------
// Security middleware
// ---------------------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    },
  },
}));

app.use(cors({ origin: false, credentials: true }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again later." },
});
app.use("/api/login", authLimiter);

// ---------------------------------------------------------------------------
// Shared CSS — companion to Perfin (indigo/lavender palette vs Perfin's warm/amber)
// ---------------------------------------------------------------------------
const SHARED_CSS = `
    :root {
      --bg: #0a0b14; --surface: rgba(255,255,255,0.04); --surface-2: rgba(255,255,255,0.07);
      --border: rgba(255,255,255,0.08); --border-hover: rgba(255,255,255,0.18);
      --text: #e8e6f0; --text-muted: rgba(232,230,240,0.5);
      --warm: #a08cd4; --warm-glow: #8b7bc8; --teal: #6b9f9f;
      --green: #6fcf97; --green-bg: rgba(111,207,151,0.1);
      --red: #eb6b6b; --red-bg: rgba(235,107,107,0.1);
      --yellow: #e8c86d; --yellow-bg: rgba(232,200,109,0.1);
      --blue: #7fa8e6; --blue-bg: rgba(127,168,230,0.1);
      --radius: 12px;
    }
    [data-theme="light"] {
      --bg: #f0eef5; --surface: rgba(0,0,0,0.03); --surface-2: rgba(0,0,0,0.06);
      --border: rgba(0,0,0,0.10); --border-hover: rgba(0,0,0,0.20);
      --text: #1a1a2e; --text-muted: rgba(26,26,46,0.5);
      --warm: #6b5ba0; --warm-glow: #5c4d90; --teal: #4a7a7a;
      --green: #2d9f5f; --green-bg: rgba(45,159,95,0.1);
      --red: #c94444; --red-bg: rgba(201,68,68,0.1);
      --yellow: #b89820; --yellow-bg: rgba(184,152,32,0.1);
      --blue: #4a78bf; --blue-bg: rgba(74,120,191,0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif; background: var(--bg);
      color: var(--text); min-height: 100vh; position: relative; overflow-x: hidden;
    }
    body::before {
      content: ''; position: fixed; top: -30%; right: -20%; width: 90vw; height: 90vh;
      background: radial-gradient(ellipse at 50% 30%, rgba(139,123,200,0.25) 0%, rgba(107,93,180,0.15) 25%, rgba(107,159,159,0.10) 50%, transparent 75%);
      pointer-events: none; z-index: 0; filter: blur(50px);
    }
    body::after {
      content: ''; position: fixed; bottom: -20%; left: -15%; width: 80vw; height: 70vh;
      background: radial-gradient(ellipse at 40% 60%, rgba(107,159,159,0.18) 0%, rgba(160,140,212,0.10) 35%, rgba(120,100,170,0.05) 60%, transparent 80%);
      pointer-events: none; z-index: 0; filter: blur(60px);
    }
    [data-theme="light"] body::before {
      background: radial-gradient(ellipse at 50% 30%, rgba(107,91,160,0.12) 0%, rgba(74,122,122,0.06) 50%, transparent 75%);
    }
    [data-theme="light"] body::after {
      background: radial-gradient(ellipse at 40% 60%, rgba(74,122,122,0.10) 0%, rgba(107,91,160,0.05) 35%, transparent 80%);
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn-loading { position: relative; color: transparent !important; pointer-events: none; }
    .btn-loading::after {
      content: ''; position: absolute; top: 50%; left: 50%; width: 14px; height: 14px;
      margin: -7px 0 0 -7px; border: 2px solid var(--warm); border-top-color: transparent;
      border-radius: 50%; animation: spin 0.6s linear infinite;
    }
    .container { max-width: 1060px; margin: 0 auto; padding: 24px 20px; position: relative; z-index: 1; }
    a { color: var(--warm); text-decoration: none; transition: color 0.2s; }
    a:hover { color: var(--text); }

    .topnav { display: flex; align-items: center; justify-content: space-between;
              padding: 20px 0; margin-bottom: 40px; }
    .topnav .logo { font-weight: 300; font-size: 13px; letter-spacing: 2px;
                    text-transform: uppercase; color: var(--text-muted); }
    .topnav .nav-links { display: flex; gap: 24px; font-size: 13px; font-weight: 400;
                         letter-spacing: 0.5px; }
    .topnav .nav-links a { color: var(--text-muted); }
    .topnav .nav-links a:hover { color: var(--text); }
    .topnav .nav-links a.active { color: var(--warm); }

    h1 { font-size: 42px; font-weight: 300; letter-spacing: -0.5px; margin-bottom: 8px; }
    .subtitle { color: var(--text-muted); margin-bottom: 36px; font-size: 15px; font-weight: 300; letter-spacing: 0.3px; }

    .top-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                 gap: 16px; margin-bottom: 36px; }
    .card { padding: 24px; border-radius: var(--radius); background: var(--surface);
            border: 1px solid var(--border); transition: all 0.3s ease; backdrop-filter: blur(12px); }
    .card:hover { border-color: var(--border-hover); background: var(--surface-2); }
    .card .label { font-size: 10px; color: var(--text-muted); text-transform: uppercase;
                   letter-spacing: 1.5px; font-weight: 500; }
    .card .value { font-size: 28px; font-weight: 300; margin-top: 8px;
                   font-variant-numeric: tabular-nums; letter-spacing: -1px; }
    .card .value.warm { color: var(--warm-glow); }
    .card .value.teal { color: var(--teal); }
    .card .value.green { color: var(--green); }
    .card .value.red { color: var(--red); }
    .card .sub { font-size: 11px; color: var(--text-muted); margin-top: 4px; font-weight: 300; }

    .actions { display: flex; gap: 10px; margin-bottom: 28px; flex-wrap: wrap; align-items: center; }
    .actions button, .actions .btn {
      padding: 9px 18px; font-size: 12px; font-weight: 500; letter-spacing: 0.5px;
      border: 1px solid var(--border); border-radius: 8px; cursor: pointer;
      background: transparent; color: var(--text-muted); transition: all 0.2s; text-transform: uppercase;
      font-family: inherit; text-decoration: none; display: inline-block;
    }
    .actions button:hover:not(:disabled), .actions .btn:hover { border-color: var(--warm); color: var(--text); }
    .actions button.primary, .actions .btn.primary { border-color: var(--warm); color: var(--warm); }
    .actions button.primary:hover:not(:disabled), .actions .btn.primary:hover { background: rgba(212,165,116,0.1); color: var(--text); }
    .actions button:disabled { opacity: 0.3; cursor: not-allowed; }

    .status-msg { padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; display: none;
                  font-size: 13px; font-weight: 400; }
    .status-msg.success { background: var(--green-bg); border: 1px solid rgba(111,207,151,0.15);
                          color: var(--green); display: block; }
    .status-msg.error { background: var(--red-bg); border: 1px solid rgba(235,107,107,0.15);
                        color: var(--red); display: block; }

    .section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
               padding: 24px; margin-bottom: 24px; backdrop-filter: blur(12px); }
    .section h2 { font-size: 10px; font-weight: 500; color: var(--text-muted); text-transform: uppercase;
                  letter-spacing: 1.5px; margin-bottom: 16px; }

    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 10px 12px; font-size: 9px; color: var(--text-muted);
         text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500;
         border-bottom: 1px solid var(--border); }
    td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; font-weight: 300; }
    tr { transition: background 0.15s; }
    tr:hover { background: var(--surface); }

    .empty-msg { text-align: center; padding: 40px; color: var(--text-muted); font-weight: 300; font-size: 14px; }

    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px;
             font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; }
    .badge.urgent { background: var(--red-bg); color: var(--red); }
    .badge.high { background: var(--yellow-bg); color: var(--yellow); }
    .badge.medium { background: var(--blue-bg); color: var(--blue); }
    .badge.low { background: var(--green-bg); color: var(--green); }
    .badge.draft { background: var(--blue-bg); color: var(--blue); }
    .badge.scheduled { background: var(--yellow-bg); color: var(--yellow); }
    .badge.sent { background: var(--green-bg); color: var(--green); }
    .badge.failed { background: var(--red-bg); color: var(--red); }
    .badge.short { background: var(--green-bg); color: var(--green); }
    .badge.long { background: var(--blue-bg); color: var(--blue); }

    /* Modal */
    .modal-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                     background: rgba(0,0,0,0.6); z-index: 100; backdrop-filter: blur(4px);
                     align-items: center; justify-content: center; }
    .modal-overlay.active { display: flex; }
    .modal { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
             padding: 32px; width: 90%; max-width: 540px; max-height: 90vh; overflow-y: auto; }
    .modal h2 { font-size: 20px; font-weight: 300; margin-bottom: 24px; }
    .modal label { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase;
                   letter-spacing: 1.5px; font-weight: 500; margin-bottom: 6px; margin-top: 16px; }
    .modal label:first-of-type { margin-top: 0; }
    .modal input, .modal select, .modal textarea {
      width: 100%; padding: 10px 14px; font-size: 14px; font-family: inherit;
      background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
      color: var(--text); outline: none; transition: border-color 0.2s;
    }
    .modal input:focus, .modal select:focus, .modal textarea:focus { border-color: var(--warm); }
    .modal textarea { min-height: 100px; resize: vertical; }
    .modal .modal-actions { display: flex; gap: 10px; margin-top: 24px; justify-content: flex-end; }
    .modal .modal-actions button { padding: 10px 20px; font-size: 13px; font-weight: 500;
      border: 1px solid var(--border); border-radius: 8px; cursor: pointer;
      background: transparent; color: var(--text-muted); font-family: inherit; transition: all 0.2s; }
    .modal .modal-actions button.primary { border-color: var(--warm); color: var(--warm); }
    .modal .modal-actions button.primary:hover { background: rgba(212,165,116,0.1); }
    .modal .modal-actions button.danger { border-color: var(--red); color: var(--red); }
    .modal .modal-actions button.danger:hover { background: var(--red-bg); }

    /* Todo-specific */
    .todo-item { display: flex; align-items: flex-start; gap: 12px; padding: 14px 0;
                 border-bottom: 1px solid rgba(255,255,255,0.04); }
    .todo-item:last-child { border-bottom: none; }
    .todo-check { width: 28px; height: 28px; min-width: 28px; border: 2px solid var(--border); border-radius: 50%;
                  cursor: pointer; flex-shrink: 0; margin-top: 2px; transition: all 0.2s;
                  display: flex; align-items: center; justify-content: center;
                  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
                  padding: 8px; box-sizing: content-box; }
    .todo-check:hover { border-color: var(--warm); }
    .todo-check:active { transform: scale(0.9); }
    .todo-check.done { border-color: var(--green); background: var(--green); }
    .todo-check.done::after { content: '\\2713'; color: var(--bg); font-size: 14px; font-weight: 700; }
    .todo-content { flex: 1; min-width: 0; }
    .todo-title { font-size: 14px; font-weight: 400; }
    .todo-title.done { text-decoration: line-through; opacity: 0.4; }
    .todo-meta { font-size: 11px; color: var(--text-muted); margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap; }
    .todo-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .todo-actions button { background: none; border: none; color: var(--text-muted); cursor: pointer;
                           font-size: 14px; padding: 10px; transition: color 0.2s;
                           -webkit-tap-highlight-color: transparent; touch-action: manipulation;
                           min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; }
    .todo-actions button:hover { color: var(--text); }
    .todo-actions button.delete:hover { color: var(--red); }

    /* Note card grid */
    .notes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .note-card { padding: 20px; border-radius: var(--radius); background: var(--surface);
                 border: 1px solid var(--border); transition: all 0.3s; cursor: pointer; }
    .note-card:hover { border-color: var(--border-hover); background: var(--surface-2); }
    .note-card.pinned { border-color: var(--warm); }
    .note-card .note-title { font-size: 14px; font-weight: 500; margin-bottom: 8px; }
    .note-card .note-preview { font-size: 12px; color: var(--text-muted); font-weight: 300;
                               line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 4;
                               -webkit-box-orient: vertical; overflow: hidden; }
    .note-card .note-preview.md { display: block; max-height: 80px; }
    .note-card .note-preview.md h2, .note-card .note-preview.md h3, .note-card .note-preview.md h4 { margin: 2px 0; }
    .md-badge { display: inline-block; font-size: 9px; padding: 1px 6px; border-radius: 8px; background: var(--surface-2); color: var(--teal); border: 1px solid var(--teal); margin-left: 6px; vertical-align: middle; }
    .note-card .note-date { font-size: 10px; color: var(--text-muted); margin-top: 12px;
                            text-transform: uppercase; letter-spacing: 0.5px; }

    /* Filters */
    .filters { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .filters button { padding: 6px 14px; font-size: 11px; font-weight: 500; letter-spacing: 0.5px;
      border: 1px solid var(--border); border-radius: 20px; cursor: pointer;
      background: transparent; color: var(--text-muted); font-family: inherit; transition: all 0.2s; }
    .filters button:hover { border-color: var(--warm); color: var(--text); }
    .filters button.active { border-color: var(--warm); color: var(--warm); background: rgba(212,165,116,0.08); }

    /* Subtasks */
    .subtask-list { margin-top: 8px; padding-left: 32px; }
    .subtask-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; }
    .subtask-check { width: 20px; height: 20px; min-width: 20px; border: 1.5px solid var(--border); border-radius: 50%;
                     cursor: pointer; flex-shrink: 0; transition: all 0.2s;
                     display: flex; align-items: center; justify-content: center;
                     -webkit-tap-highlight-color: transparent; touch-action: manipulation;
                     padding: 10px; box-sizing: content-box; }
    .subtask-check:hover { border-color: var(--warm); }
    .subtask-check:active { transform: scale(0.9); }
    .subtask-check.done { border-color: var(--green); background: var(--green); }
    .subtask-check.done::after { content: '\\2713'; color: var(--bg); font-size: 10px; font-weight: 700; }
    .subtask-text { flex: 1; min-width: 0; }
    .subtask-text.done { text-decoration: line-through; opacity: 0.4; }
    .subtask-edit-btn { background: none; border: none; color: var(--text-muted); cursor: pointer;
                        font-size: 12px; padding: 8px; -webkit-tap-highlight-color: transparent;
                        touch-action: manipulation; transition: color 0.2s; }
    .subtask-edit-btn:hover { color: var(--warm); }
    .subtask-add { font-size: 11px; color: var(--text-muted); cursor: pointer; padding: 8px 0;
                   -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    .subtask-add:hover { color: var(--warm); }
    .subtask-progress { height: 3px; background: var(--surface-2); border-radius: 2px; margin-top: 6px; overflow: hidden; }
    .subtask-progress-fill { height: 100%; background: var(--green); border-radius: 2px; transition: width 0.3s; }

    /* Calendar */
    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .cal-header { text-align: center; font-size: 10px; color: var(--text-muted); text-transform: uppercase;
                  letter-spacing: 1px; padding: 8px 0; font-weight: 500; }
    .cal-day { min-height: 80px; padding: 6px; border-radius: 6px; background: var(--surface);
               border: 1px solid transparent; transition: all 0.2s; cursor: pointer; }
    .cal-day:hover { border-color: var(--border-hover); }
    .cal-day.today { border-color: var(--warm); }
    .cal-day.other-month { opacity: 0.3; }
    .cal-day-num { font-size: 11px; font-weight: 500; margin-bottom: 4px; }
    .cal-event { font-size: 9px; padding: 2px 4px; border-radius: 3px; margin-bottom: 2px;
                 white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cal-event.todo { background: var(--blue-bg); color: var(--blue); }
    .cal-event.email { background: var(--yellow-bg); color: var(--yellow); }
    .cal-event.note { background: var(--green-bg); color: var(--green); }

    /* Search */
    .search-bar { position: relative; margin-bottom: 24px; }
    .search-bar input { width: 100%; padding: 12px 16px 12px 40px; font-size: 14px; font-family: inherit;
                        background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
                        color: var(--text); outline: none; transition: border-color 0.2s; }
    .search-bar input:focus { border-color: var(--warm); }
    .search-bar .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
                               color: var(--text-muted); font-size: 16px; }
    .search-results .result-item { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04);
                                   cursor: pointer; transition: background 0.15s; }
    .search-results .result-item:hover { background: var(--surface); }
    .search-results .result-type { font-size: 9px; text-transform: uppercase; letter-spacing: 1px;
                                   color: var(--text-muted); margin-bottom: 4px; }

    /* Drag and drop */
    .todo-item.dragging { opacity: 0.4; }
    .todo-item.drag-over { border-top: 2px solid var(--warm); }
    .drag-handle { cursor: grab; color: var(--text-muted); font-size: 14px; padding: 4px;
                   user-select: none; flex-shrink: 0; }
    .drag-handle:active { cursor: grabbing; }

    /* Keyboard shortcut hint */
    .kbd { display: inline-block; padding: 2px 6px; background: var(--surface-2); border: 1px solid var(--border);
           border-radius: 4px; font-size: 10px; font-family: monospace; color: var(--text-muted); }

    /* Recurring badge */
    .badge.recurring { background: rgba(212,165,116,0.1); color: var(--warm); }
    .badge.streak { background: rgba(76,175,80,0.1); color: var(--green); }
    .badge.blocked { background: rgba(239,83,80,0.1); color: var(--red); }
    .badge.blocking { background: rgba(255,193,7,0.1); color: var(--yellow); }
    .todo-blocked { opacity: 0.65; }

    @media (max-width: 768px) {
      .topnav { flex-direction: column; gap: 12px; align-items: flex-start; }
      .topnav .nav-links { display: none; gap: 16px; flex-wrap: wrap; }
      .topnav .nav-links.mobile-open { display: flex; }
      .topnav .mobile-toggle { display: block; }
      h1 { font-size: 28px; }
      .top-cards { grid-template-columns: repeat(2, 1fr); }
      .notes-grid { grid-template-columns: 1fr; }
      .modal { width: 95%; padding: 24px; }
      .cal-day { min-height: 50px; }
      .cal-event { font-size: 8px; }
      .container { padding: 16px 12px; }
      .todo-item { padding: 14px; }
      .filters button { padding: 8px 16px; font-size: 12px; }
      .subtask-list { padding-left: 16px; }
      .drag-handle { display: none; }
      .dash-two-col { grid-template-columns: 1fr !important; }
      .mobile-fab { display: flex !important; }
      .bottom-nav { display: flex !important; }
      body { padding-bottom: 70px; }
    }
    @media (max-width: 480px) {
      .topnav .nav-links { gap: 12px; font-size: 12px; }
      .topnav .nav-links a { padding: 6px 0; }
      h1 { font-size: 22px; }
      .top-cards { grid-template-columns: 1fr; }
      .modal { width: 98%; padding: 16px; }
      .section { padding: 16px; }
      .todo-meta { gap: 8px; }
      .badge { font-size: 9px; padding: 2px 6px; }
      .filters { gap: 6px; overflow-x: auto; flex-wrap: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 4px; }
      .filters::-webkit-scrollbar { display: none; }
      .filters button { padding: 6px 12px; font-size: 11px; white-space: nowrap; }
      .cal-grid { font-size: 10px; }
      .cal-day { min-height: 40px; padding: 3px; }
      .actions { gap: 6px; }
      .actions button, .actions .btn { padding: 8px 14px; font-size: 11px; }
    }
    @media (max-width: 360px) {
      .container { padding: 12px 8px; }
      h1 { font-size: 20px; }
      .topnav .nav-links { gap: 10px; font-size: 11px; }
      .modal { padding: 12px; }
    }

    /* Mobile bottom navigation */
    .bottom-nav { display: none; position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg);
                  border-top: 1px solid var(--border); z-index: 99; justify-content: space-around;
                  padding: 8px 0 env(safe-area-inset-bottom, 8px); backdrop-filter: blur(20px); }
    .bottom-nav a { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 12px;
                    font-size: 9px; color: var(--text-muted); text-decoration: none; letter-spacing: 0.5px;
                    text-transform: uppercase; font-weight: 500; transition: color 0.2s;
                    -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    .bottom-nav a .nav-icon { font-size: 18px; }
    .bottom-nav a.active { color: var(--warm); }
    .bottom-nav a:hover { color: var(--text); }

    /* Mobile FAB (floating action button) */
    .mobile-fab { display: none !important; position: fixed; bottom: 80px; right: 20px; width: 52px; height: 52px;
                  border-radius: 50%; background: var(--warm); color: #fff; border: none; font-size: 26px;
                  cursor: pointer; z-index: 98; box-shadow: 0 4px 16px rgba(0,0,0,0.3); align-items: center;
                  justify-content: center; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    .mobile-fab:active { transform: scale(0.92); }

    /* Mobile hamburger */
    .topnav .mobile-toggle { display: none; background: none; border: none; color: var(--text); font-size: 22px;
                              cursor: pointer; padding: 8px; -webkit-tap-highlight-color: transparent; }

    /* Swipe gesture hint */
    .swipe-hint { display: none; }
    @media (max-width: 768px) {
      .swipe-hint { display: block; font-size: 10px; color: var(--text-muted); text-align: center; padding: 4px; }
    }
`;

// ---------------------------------------------------------------------------
// Shared JS utilities (included in all pages via pageHead)
// ---------------------------------------------------------------------------
const SHARED_JS = `
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function renderMd(s){
  if(!s)return'';
  return s
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.+)$/gm,'<h4 style="margin:8px 0 4px;font-size:13px;font-weight:600;">$1</h4>')
    .replace(/^## (.+)$/gm,'<h3 style="margin:8px 0 4px;font-size:14px;font-weight:600;">$1</h3>')
    .replace(/^# (.+)$/gm,'<h2 style="margin:8px 0 4px;font-size:15px;font-weight:600;">$1</h2>')
    .replace(/\\*\\*\\*(.+?)\\*\\*\\*/g,'<strong><em>$1</em></strong>')
    .replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>')
    .replace(/\\*(.+?)\\*/g,'<em>$1</em>')
    .replace(/~~(.+?)~~/g,'<del>$1</del>')
    .replace(/\`([^\`]+)\`/g,'<code style="background:var(--surface-2);padding:1px 5px;border-radius:3px;font-size:11px;">$1</code>')
    .replace(/^- \\[x\\] (.+)$/gm,'<div style="margin:2px 0;"><span style="color:var(--green);margin-right:4px;">&#9745;</span><s style="opacity:0.5;">$1</s></div>')
    .replace(/^- \\[ \\] (.+)$/gm,'<div style="margin:2px 0;"><span style="color:var(--text-muted);margin-right:4px;">&#9744;</span>$1</div>')
    .replace(/^[*-] (.+)$/gm,'<div style="margin:2px 0;padding-left:12px;">&bull; $1</div>')
    .replace(/^\\d+\\. (.+)$/gm,'<div style="margin:2px 0;padding-left:12px;">$1</div>')
    .replace(/^> (.+)$/gm,'<blockquote style="border-left:2px solid var(--warm);padding-left:10px;margin:4px 0;color:var(--text-muted);font-style:italic;">$1</blockquote>')
    .replace(/^---$/gm,'<hr style="border:none;border-top:1px solid var(--border);margin:8px 0;">')
    .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g,'<a href="$2" target="_blank" style="color:var(--teal);text-decoration:underline;">$1</a>')
    .replace(/\\n/g,'<br>');
}
// Offline detection and sync
window.addEventListener('online', function() {
  document.body.classList.remove('offline');
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage('sync');
  }
  var offBanner = document.getElementById('offline-banner');
  if (offBanner) offBanner.style.display = 'none';
});
window.addEventListener('offline', function() {
  document.body.classList.add('offline');
  var offBanner = document.getElementById('offline-banner');
  if (!offBanner) {
    offBanner = document.createElement('div');
    offBanner.id = 'offline-banner';
    offBanner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:var(--yellow);color:#000;text-align:center;padding:6px;font-size:12px;font-weight:500;z-index:9999;';
    offBanner.textContent = 'You are offline. Changes will sync when reconnected.';
    document.body.appendChild(offBanner);
  }
  offBanner.style.display = 'block';
});
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('message', function(e) {
    if (e.data === 'synced' && typeof load === 'function') load();
  });
}
var _touchStartX=0,_touchStartY=0;
document.addEventListener('touchstart',function(e){_touchStartX=e.changedTouches[0].screenX;_touchStartY=e.changedTouches[0].screenY;},{passive:true});
document.addEventListener('touchend',function(e){
  var dx=e.changedTouches[0].screenX-_touchStartX,dy=e.changedTouches[0].screenY-_touchStartY;
  if(Math.abs(dx)>100&&Math.abs(dx)>Math.abs(dy)*1.5){
    var pages=['/','/todos','/emails','/notes','/calendar','/contacts','/review','/settings'];
    var cur=pages.indexOf(location.pathname);if(cur<0)return;
    if(dx<0&&cur<pages.length-1)location.href=pages[cur+1];
    else if(dx>0&&cur>0)location.href=pages[cur-1];
  }
},{passive:true});
// Voice input (Web Speech API)
function startVoiceInput(targetId, onDone) {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('Voice input not supported in this browser. Try Chrome or Edge.'); return; }
  var recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = function(e) {
    var text = e.results[0][0].transcript;
    var target = document.getElementById(targetId);
    if (target) {
      if (target.tagName === 'TEXTAREA') target.value += (target.value ? ' ' : '') + text;
      else target.value = text;
    }
    if (onDone) onDone(text);
  };
  recognition.onerror = function(e) { if (e.error !== 'no-speech') console.error('Voice error:', e.error); };
  recognition.start();
}
var _undoTimer=null;
function showUndo(msg,type,id){
  clearTimeout(_undoTimer);
  var el=document.getElementById('undo-toast');
  if(!el){el=document.createElement('div');el.id='undo-toast';el.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface-2);border:1px solid var(--border);padding:12px 20px;border-radius:12px;display:flex;align-items:center;gap:12px;z-index:9999;backdrop-filter:blur(20px);font-size:14px;color:var(--text);box-shadow:0 8px 32px rgba(0,0,0,0.3);';document.body.appendChild(el);}
  el.innerHTML=esc(msg)+' <button onclick="undoDelete(\\''+type+'\\','+id+')" style="background:var(--warm);color:#fff;border:none;padding:4px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;">Undo</button>';
  el.style.display='flex';
  _undoTimer=setTimeout(function(){el.style.display='none';},6000);
}
async function undoDelete(type,id){
  await fetch('/api/trash/'+type+'/'+id+'/restore',{method:'POST'});
  var el=document.getElementById('undo-toast');if(el)el.style.display='none';
  if(typeof load==='function')load();
}
`;

// ---------------------------------------------------------------------------
// Shared HTML helpers
// ---------------------------------------------------------------------------
function pageHead(title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Per-sistant</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#0a0b14">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${SHARED_CSS}</style>
  <script>${SHARED_JS}</script>
</head>`;
}

function navBar(activePage) {
  const links = [
    { href: "/", label: "Dashboard", icon: "&#9632;" },
    { href: "/todos", label: "To-Dos", icon: "&#9745;" },
    { href: "/emails", label: "Emails", icon: "&#9993;" },
    { href: "/notes", label: "Notes", icon: "&#9998;" },
    { href: "/calendar", label: "Calendar", icon: "&#128197;" },
    { href: "/contacts", label: "Contacts", icon: "&#128100;" },
    { href: "/review", label: "Review", icon: "&#128202;" },
    { href: "/settings", label: "Settings", icon: "&#9881;" },
  ];
  const bottomLinks = links.slice(0, 5); // Dashboard, Todos, Emails, Notes, Calendar
  const perfinLink = PERFIN_URL ? `<a href="${PERFIN_URL}" target="_blank">Perfin</a>` : "";
  return `<nav class="topnav">
    <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
      <div class="logo">Per-sistant</div>
      <button class="mobile-toggle" onclick="document.querySelector('.nav-links').classList.toggle('mobile-open')" aria-label="Toggle menu">&#9776;</button>
    </div>
    <div class="nav-links">
      ${links.map(l => `<a href="${l.href}" class="${activePage === l.href ? 'active' : ''}">${l.label}</a>`).join("\n      ")}
      ${perfinLink}
    </div>
  </nav>
  <nav class="bottom-nav">
    ${bottomLinks.map(l => `<a href="${l.href}" class="${activePage === l.href ? 'active' : ''}"><span class="nav-icon">${l.icon}</span>${l.label}</a>`).join("\n    ")}
  </nav>`;
}

function themeScript() {
  return `<script>
    (function(){
      var t = localStorage.getItem('theme') || 'dark';
      var effective = t;
      if (t === 'auto') effective = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      if (effective === 'light') document.documentElement.setAttribute('data-theme','light');
      if (t === 'auto') window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(e) {
        if (e.matches) document.documentElement.setAttribute('data-theme','light');
        else document.documentElement.removeAttribute('data-theme');
      });
    })();
  </script>`;
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------
app.get("/login", (req, res) => {
  if (!AUTH_SECRET) return res.redirect("/");
  const isPIN = AUTH_MODE === "pin";
  res.send(`${pageHead("Login")}
<body>
${themeScript()}
<div class="container">
  <div style="max-width:360px;margin:120px auto 0;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="font-size:13px;font-weight:300;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);">Per-sistant</div>
    </div>
    <div class="section" style="text-align:center;">
      <h2>${isPIN ? "Enter PIN" : "Enter Password"}</h2>
      <div id="error" class="status-msg" style="margin-top:12px;"></div>
      ${isPIN ? `
      <div id="dots" style="display:flex;gap:10px;justify-content:center;margin:24px 0;"></div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(60px,72px));gap:12px;justify-content:center;max-width:260px;margin:0 auto;">
        ${[1,2,3,4,5,6,7,8,9,'',0,'<'].map(k => k === '' ? '<div></div>' :
          `<button onclick="${k === '<' ? 'pinDel()' : 'pinAdd('+k+')'}" style="width:100%;aspect-ratio:1;border-radius:50%;border:1px solid var(--border);background:transparent;color:var(--text);font-size:22px;font-weight:300;cursor:pointer;font-family:inherit;transition:all 0.2s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;">${k === '<' ? '&#9003;' : k}</button>`
        ).join('')}
      </div>
      <script>
        var pin = '';
        function pinAdd(d) { pin += d; renderDots(); if (pin.length >= ${SESSION_PIN ? SESSION_PIN.length : 4}) submit(); }
        function pinDel() { pin = pin.slice(0,-1); renderDots(); }
        function renderDots() {
          var h = ''; for (var i = 0; i < pin.length; i++) h += '<div style="width:12px;height:12px;border-radius:50%;background:var(--warm);"></div>';
          document.getElementById('dots').innerHTML = h;
        }
        function submit() {
          fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:pin}) })
            .then(r => r.json()).then(d => { if (d.ok) location.href='/'; else { pin=''; renderDots(); document.getElementById('error').className='status-msg error'; document.getElementById('error').textContent=d.error||'Invalid PIN'; } });
        }
      </script>
      ` : `
      <form onsubmit="event.preventDefault(); submit();" style="margin-top:20px;">
        <input type="password" id="pw" placeholder="Password" style="width:100%;padding:12px 16px;font-size:15px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);outline:none;margin-bottom:12px;">
        <button type="submit" class="primary" style="width:100%;padding:12px;font-size:13px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;">Log in</button>
      </form>
      <script>
        function submit() {
          fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:document.getElementById('pw').value}) })
            .then(r => r.json()).then(d => { if (d.ok) location.href='/'; else { document.getElementById('error').className='status-msg error'; document.getElementById('error').textContent=d.error||'Invalid password'; } });
        }
      </script>
      `}
    </div>
  </div>
</div>
</body></html>`);
});

app.post("/api/login", async (req, res) => {
  const { password } = req.body;
  if (!AUTH_SECRET) return res.json({ ok: true });
  if (password === AUTH_SECRET) {
    let timeout = 15;
    try {
      const r = await pool.query("SELECT session_timeout_minutes FROM user_settings WHERE id = 1");
      if (r.rows.length) timeout = r.rows[0].session_timeout_minutes;
    } catch {}
    req.session.authenticated = true;
    req.session.lastActivity = Date.now();
    req.session.timeoutMinutes = timeout;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: "Invalid credentials." });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ============================================================================
// API — Todos
// ============================================================================
app.get("/api/todos", async (req, res) => {
  try {
    const { horizon, priority, completed, category, limit } = req.query;
    let where = ["deleted_at IS NULL"];
    let params = [];
    let idx = 1;
    if (horizon) { where.push(`horizon = $${idx++}`); params.push(horizon); }
    if (priority) { where.push(`priority = $${idx++}`); params.push(priority); }
    if (completed !== undefined) { where.push(`completed = $${idx++}`); params.push(completed === "true"); }
    if (category) { where.push(`category = $${idx++}`); params.push(category); }
    const clause = "WHERE " + where.join(" AND ");
    const limitClause = limit ? ` LIMIT $${idx++}` : "";
    if (limit) params.push(parseInt(limit, 10));
    const r = await pool.query(`SELECT * FROM todos ${clause} ORDER BY completed ASC, sort_order ASC, CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC${limitClause}`, params);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/todos", async (req, res) => {
  try {
    const { title, description, priority, horizon, category, due_date, recurring, recurrence_rule } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required." });
    if (priority && !VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: "Invalid priority. Must be: " + VALID_PRIORITIES.join(", ") });
    if (horizon && !VALID_HORIZONS.includes(horizon)) return res.status(400).json({ error: "Invalid horizon. Must be: " + VALID_HORIZONS.join(", ") });
    if (recurrence_rule && !VALID_RECURRENCE_RULES.includes(recurrence_rule)) return res.status(400).json({ error: "Invalid recurrence rule. Must be: " + VALID_RECURRENCE_RULES.join(", ") });
    const r = await pool.query(
      `INSERT INTO todos (title, description, priority, horizon, category, due_date, recurring, recurrence_rule) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, description || null, priority || "medium", horizon || "short", category || null, due_date || null, recurring || false, recurrence_rule || null]
    );
    runAutomations('todo_created', r.rows[0], 'todo').catch(() => {});
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/todos/:id", async (req, res) => {
  try {
    const { title, description, priority, horizon, category, due_date, completed, sort_order, recurring, recurrence_rule } = req.body;
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: "Invalid priority. Must be: " + VALID_PRIORITIES.join(", ") });
    if (horizon !== undefined && !VALID_HORIZONS.includes(horizon)) return res.status(400).json({ error: "Invalid horizon. Must be: " + VALID_HORIZONS.join(", ") });
    if (recurrence_rule !== undefined && recurrence_rule !== null && !VALID_RECURRENCE_RULES.includes(recurrence_rule)) return res.status(400).json({ error: "Invalid recurrence rule. Must be: " + VALID_RECURRENCE_RULES.join(", ") });
    const fields = [];
    const params = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title = $${idx++}`); params.push(title); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); params.push(description); }
    if (priority !== undefined) { fields.push(`priority = $${idx++}`); params.push(priority); }
    if (horizon !== undefined) { fields.push(`horizon = $${idx++}`); params.push(horizon); }
    if (category !== undefined) { fields.push(`category = $${idx++}`); params.push(category); }
    if (due_date !== undefined) { fields.push(`due_date = $${idx++}`); params.push(due_date || null); }
    if (sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); params.push(sort_order); }
    if (recurring !== undefined) { fields.push(`recurring = $${idx++}`); params.push(recurring); }
    if (recurrence_rule !== undefined) { fields.push(`recurrence_rule = $${idx++}`); params.push(recurrence_rule); }
    if (req.body.location_name !== undefined) { fields.push(`location_name = $${idx++}`); params.push(req.body.location_name); }
    if (req.body.location_lat !== undefined) { fields.push(`location_lat = $${idx++}`); params.push(req.body.location_lat); }
    if (req.body.location_lng !== undefined) { fields.push(`location_lng = $${idx++}`); params.push(req.body.location_lng); }
    if (req.body.location_radius !== undefined) { fields.push(`location_radius = $${idx++}`); params.push(req.body.location_radius); }
    if (completed !== undefined) {
      fields.push(`completed = $${idx++}`); params.push(completed);
      fields.push(`completed_at = $${idx++}`); params.push(completed ? new Date().toISOString() : null);
    }
    if (!fields.length) return res.status(400).json({ error: "No fields to update." });
    params.push(req.params.id);
    const r = await pool.query(`UPDATE todos SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, params);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    if (completed) runAutomations('todo_completed', r.rows[0], 'todo').catch(() => {});
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/todos/:id", async (req, res) => {
  try {
    const r = await pool.query("UPDATE todos SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// API — Emails
// ============================================================================
app.get("/api/emails", async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? "WHERE deleted_at IS NULL AND status = $1" : "WHERE deleted_at IS NULL";
    const params = status ? [status] : [];
    const r = await pool.query(`SELECT * FROM emails ${where} ORDER BY CASE status WHEN 'scheduled' THEN 0 WHEN 'draft' THEN 1 WHEN 'sent' THEN 2 ELSE 3 END, created_at DESC`, params);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/emails", async (req, res) => {
  try {
    const { recipient_name, recipient_email, subject, body, scheduled_at } = req.body;
    if (!recipient_email || !subject || !body) {
      return res.status(400).json({ error: "Recipient email, subject, and body are required." });
    }
    if (!EMAIL_REGEX.test(recipient_email)) {
      return res.status(400).json({ error: "Invalid email address format." });
    }
    const status = scheduled_at ? "scheduled" : "draft";
    const r = await pool.query(
      `INSERT INTO emails (recipient_name, recipient_email, subject, body, status, scheduled_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [recipient_name || null, recipient_email, subject, body, status, scheduled_at || null]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/emails/:id", async (req, res) => {
  try {
    const { recipient_name, recipient_email, subject, body, scheduled_at, status } = req.body;
    const fields = [];
    const params = [];
    let idx = 1;
    if (recipient_name !== undefined) { fields.push(`recipient_name = $${idx++}`); params.push(recipient_name); }
    if (recipient_email !== undefined) { fields.push(`recipient_email = $${idx++}`); params.push(recipient_email); }
    if (subject !== undefined) { fields.push(`subject = $${idx++}`); params.push(subject); }
    if (body !== undefined) { fields.push(`body = $${idx++}`); params.push(body); }
    if (scheduled_at !== undefined) { fields.push(`scheduled_at = $${idx++}`); params.push(scheduled_at); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); params.push(status); }
    if (!fields.length) return res.status(400).json({ error: "No fields to update." });
    params.push(req.params.id);
    const r = await pool.query(`UPDATE emails SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, params);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/emails/:id", async (req, res) => {
  try {
    const r = await pool.query("UPDATE emails SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/emails/:id/send", async (req, res) => {
  if (!nodemailer) return res.status(500).json({ error: "nodemailer not installed." });
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) return res.status(500).json({ error: "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env" });
  try {
    const r = await pool.query("SELECT * FROM emails WHERE id = $1", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    const email = r.rows[0];
    if (!EMAIL_REGEX.test(email.recipient_email)) {
      return res.status(400).json({ error: "Invalid recipient email address." });
    }
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_PORT === "465",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email.recipient_email,
      subject: email.subject,
      text: email.body,
    });
    await pool.query("UPDATE emails SET status = 'sent', sent_at = now() WHERE id = $1", [req.params.id]);
    res.json({ ok: true, message: "Email sent successfully." });
  } catch (err) {
    await pool.query("UPDATE emails SET status = 'failed', error_message = $1 WHERE id = $2", [err.message, req.params.id]);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// API — Notes
// ============================================================================
app.get("/api/notes", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY pinned DESC, updated_at DESC");
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/notes", async (req, res) => {
  try {
    const { title, content, pinned, color, reminder_at, tags, format } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required." });
    if (color && !VALID_NOTE_COLORS.includes(color)) return res.status(400).json({ error: "Invalid color. Must be: " + VALID_NOTE_COLORS.join(", ") });
    if (tags && !Array.isArray(tags)) return res.status(400).json({ error: "Tags must be an array." });
    if (format && !["plain", "markdown"].includes(format)) return res.status(400).json({ error: "Invalid format. Must be: plain, markdown" });
    const r = await pool.query(
      `INSERT INTO notes (title, content, pinned, color, reminder_at, tags, format) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title || null, content, pinned || false, color || "default", reminder_at || null, tags || null, format || "plain"]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/notes/:id", async (req, res) => {
  try {
    const { title, content, pinned, color, reminder_at, tags, format } = req.body;
    if (color !== undefined && !VALID_NOTE_COLORS.includes(color)) return res.status(400).json({ error: "Invalid color. Must be: " + VALID_NOTE_COLORS.join(", ") });
    if (tags !== undefined && tags !== null && !Array.isArray(tags)) return res.status(400).json({ error: "Tags must be an array." });
    if (format !== undefined && !["plain", "markdown"].includes(format)) return res.status(400).json({ error: "Invalid format. Must be: plain, markdown" });
    const fields = [];
    const params = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title = $${idx++}`); params.push(title); }
    if (content !== undefined) { fields.push(`content = $${idx++}`); params.push(content); }
    if (pinned !== undefined) { fields.push(`pinned = $${idx++}`); params.push(pinned); }
    if (color !== undefined) { fields.push(`color = $${idx++}`); params.push(color); }
    if (reminder_at !== undefined) { fields.push(`reminder_at = $${idx++}`); params.push(reminder_at); }
    if (tags !== undefined) { fields.push(`tags = $${idx++}`); params.push(tags); }
    if (format !== undefined) { fields.push(`format = $${idx++}`); params.push(format); }
    if (!fields.length) return res.status(400).json({ error: "No fields to update." });
    params.push(req.params.id);
    const r = await pool.query(`UPDATE notes SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, params);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/notes/:id", async (req, res) => {
  try {
    const r = await pool.query("UPDATE notes SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// API — Bulk Actions
// ============================================================================
app.post("/api/bulk/todos", async (req, res) => {
  try {
    const { ids, action, data } = req.body;
    if (!ids || !Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "ids array is required." });
    if (!action) return res.status(400).json({ error: "action is required." });
    if (action === "complete") {
      await pool.query("UPDATE todos SET completed = true, completed_at = now() WHERE id = ANY($1) AND deleted_at IS NULL", [ids]);
    } else if (action === "delete") {
      await pool.query("UPDATE todos SET deleted_at = now() WHERE id = ANY($1) AND deleted_at IS NULL", [ids]);
    } else if (action === "set_priority" && data?.priority && VALID_PRIORITIES.includes(data.priority)) {
      await pool.query("UPDATE todos SET priority = $1 WHERE id = ANY($2) AND deleted_at IS NULL", [data.priority, ids]);
    } else if (action === "set_horizon" && data?.horizon && VALID_HORIZONS.includes(data.horizon)) {
      await pool.query("UPDATE todos SET horizon = $1 WHERE id = ANY($2) AND deleted_at IS NULL", [data.horizon, ids]);
    } else {
      return res.status(400).json({ error: "Invalid action." });
    }
    res.json({ ok: true, count: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/bulk/emails", async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!ids || !Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "ids array is required." });
    if (action === "delete") {
      await pool.query("UPDATE emails SET deleted_at = now() WHERE id = ANY($1) AND deleted_at IS NULL", [ids]);
    } else {
      return res.status(400).json({ error: "Invalid action." });
    }
    res.json({ ok: true, count: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/bulk/notes", async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!ids || !Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "ids array is required." });
    if (action === "delete") {
      await pool.query("UPDATE notes SET deleted_at = now() WHERE id = ANY($1) AND deleted_at IS NULL", [ids]);
    } else {
      return res.status(400).json({ error: "Invalid action." });
    }
    res.json({ ok: true, count: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — Contacts
// ============================================================================
app.get("/api/contacts", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM contacts ORDER BY name ASC");
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/contacts", async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: "Name and email are required." });
    const r = await pool.query(
      `INSERT INTO contacts (name, email) VALUES ($1, $2) RETURNING *`,
      [name, email]
    );
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Contact with that name already exists." });
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/contacts/:id", async (req, res) => {
  try {
    const { name, email } = req.body;
    const fields = [];
    const params = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); params.push(name); }
    if (email !== undefined) { fields.push(`email = $${idx++}`); params.push(email); }
    if (!fields.length) return res.status(400).json({ error: "No fields to update." });
    params.push(req.params.id);
    const r = await pool.query(`UPDATE contacts SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, params);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/contacts/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM contacts WHERE id = $1 RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lookup contact by name (for "send email to <name>")
app.get("/api/contacts/lookup/:name", async (req, res) => {
  try {
    const name = req.params.name.toLowerCase();
    // Check DB first
    const r = await pool.query("SELECT * FROM contacts WHERE LOWER(name) = $1", [name]);
    if (r.rows.length) return res.json(r.rows[0]);
    // Check env contacts
    for (const [n, e] of Object.entries(envContacts)) {
      if (n.toLowerCase() === name) return res.json({ name: n, email: e });
    }
    res.status(404).json({ error: "Contact not found." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// API — Settings
// ============================================================================
app.get("/api/settings", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM user_settings WHERE id = 1");
    const settings = r.rows[0] || { theme: "dark", session_timeout_minutes: 15, default_horizon: "short" };
    settings.smtp_configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
    settings.ai_configured = !!(Anthropic && process.env.ANTHROPIC_API_KEY);
    settings.perfin_url = PERFIN_URL || settings.perfin_url || null;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/settings", async (req, res) => {
  try {
    const { theme, session_timeout_minutes, default_horizon, perfin_url, dashboard_layout } = req.body;
    const fields = [];
    const params = [];
    let idx = 1;
    if (theme !== undefined) { fields.push(`theme = $${idx++}`); params.push(theme); }
    if (session_timeout_minutes !== undefined) { fields.push(`session_timeout_minutes = $${idx++}`); params.push(session_timeout_minutes); }
    if (default_horizon !== undefined) { fields.push(`default_horizon = $${idx++}`); params.push(default_horizon); }
    if (perfin_url !== undefined) { fields.push(`perfin_url = $${idx++}`); params.push(perfin_url || null); }
    if (dashboard_layout !== undefined) { fields.push(`dashboard_layout = $${idx++}`); params.push(JSON.stringify(dashboard_layout)); }
    if (!fields.length) return res.status(400).json({ error: "No fields to update." });
    const r = await pool.query(`UPDATE user_settings SET ${fields.join(", ")} WHERE id = 1 RETURNING *`, params);
    if (theme && req.session) req.session.theme = theme;
    if (session_timeout_minutes && req.session) req.session.timeoutMinutes = session_timeout_minutes;
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// API — Dashboard stats
// ============================================================================
app.get("/api/stats", async (req, res) => {
  try {
    const [todos, emails, notes] = await Promise.all([
      pool.query("SELECT count(*) FILTER (WHERE NOT completed) as pending, count(*) FILTER (WHERE completed) as done, count(*) FILTER (WHERE NOT completed AND priority = 'urgent') as urgent, count(*) FILTER (WHERE NOT completed AND due_date <= CURRENT_DATE) as overdue FROM todos WHERE deleted_at IS NULL"),
      pool.query("SELECT count(*) FILTER (WHERE status = 'draft') as drafts, count(*) FILTER (WHERE status = 'scheduled') as scheduled, count(*) FILTER (WHERE status = 'sent') as sent FROM emails WHERE deleted_at IS NULL"),
      pool.query("SELECT count(*) as total FROM notes WHERE deleted_at IS NULL"),
    ]);
    res.json({
      todos: todos.rows[0],
      emails: emails.rows[0],
      notes: notes.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================================================
// API — Subtasks
// ============================================================================
app.get("/api/todos/:id/subtasks", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM subtasks WHERE todo_id = $1 ORDER BY sort_order, id", [req.params.id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/todos/:id/subtasks", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required." });
    const r = await pool.query("INSERT INTO subtasks (todo_id, title) VALUES ($1, $2) RETURNING *", [req.params.id, title]);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/api/subtasks/:id", async (req, res) => {
  try {
    const { title, completed, sort_order } = req.body;
    const fields = []; const params = []; let idx = 1;
    if (title !== undefined) { fields.push(`title = $${idx++}`); params.push(title); }
    if (completed !== undefined) { fields.push(`completed = $${idx++}`); params.push(completed); }
    if (sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); params.push(sort_order); }
    if (!fields.length) return res.status(400).json({ error: "No fields." });
    params.push(req.params.id);
    const r = await pool.query(`UPDATE subtasks SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, params);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/subtasks/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM subtasks WHERE id = $1 RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — Recurring tasks
// ============================================================================
app.post("/api/todos/:id/complete-recurring", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM todos WHERE id = $1", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    const todo = r.rows[0];
    if (!todo.recurring || !todo.recurrence_rule) {
      return res.status(400).json({ error: "Not a recurring task." });
    }
    // Calculate streak: check if completed on time (before or on due date)
    const today = new Date().toISOString().split("T")[0];
    const isOnTime = !todo.due_date || today <= todo.due_date.toISOString().split("T")[0];
    let newStreak = isOnTime ? (todo.streak_count || 0) + 1 : 1;
    let newBest = Math.max(newStreak, todo.best_streak || 0);
    // Mark current as completed with streak info
    await pool.query("UPDATE todos SET completed = true, completed_at = now(), streak_count = $2, best_streak = $3, last_streak_date = $4 WHERE id = $1",
      [todo.id, newStreak, newBest, today]);
    // Calculate next due date
    const rule = todo.recurrence_rule;
    let nextDue = todo.due_date ? new Date(todo.due_date) : new Date();
    if (rule === "daily") nextDue.setDate(nextDue.getDate() + 1);
    else if (rule === "weekdays") {
      do { nextDue.setDate(nextDue.getDate() + 1); } while (nextDue.getDay() === 0 || nextDue.getDay() === 6);
    } else if (rule === "weekly") nextDue.setDate(nextDue.getDate() + 7);
    else if (rule === "monthly") nextDue.setMonth(nextDue.getMonth() + 1);
    else if (rule === "yearly") nextDue.setFullYear(nextDue.getFullYear() + 1);
    // Create next instance with streak carried forward
    const n = await pool.query(
      `INSERT INTO todos (title, description, priority, horizon, category, due_date, recurring, recurrence_rule, recurrence_parent_id, streak_count, best_streak, last_streak_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [todo.title, todo.description, todo.priority, todo.horizon, todo.category,
       nextDue.toISOString().split("T")[0], true, rule, todo.recurrence_parent_id || todo.id,
       newStreak, newBest, today]
    );
    res.json({ completed: todo, next: n.rows[0], streak: newStreak, best_streak: newBest });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — Streak/Habit Stats
// ============================================================================
app.get("/api/streaks", async (req, res) => {
  try {
    // Get active recurring tasks with their current streaks
    const active = await pool.query(
      "SELECT id, title, recurrence_rule, streak_count, best_streak, last_streak_date, due_date FROM todos WHERE deleted_at IS NULL AND recurring = true AND completed = false ORDER BY streak_count DESC"
    );
    // Get top streaks across all recurring tasks (including completed ones)
    const top = await pool.query(
      "SELECT DISTINCT ON (COALESCE(recurrence_parent_id, id)) COALESCE(recurrence_parent_id, id) as chain_id, title, best_streak, streak_count, recurrence_rule FROM todos WHERE recurring = true AND best_streak > 0 ORDER BY COALESCE(recurrence_parent_id, id), best_streak DESC"
    );
    res.json({ active: active.rows, top_streaks: top.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — Automations / Rules Engine
// ============================================================================
const VALID_TRIGGERS = ['todo_created', 'todo_completed', 'email_created', 'note_created', 'schedule'];
const VALID_ACTIONS = ['set_priority', 'set_category', 'set_horizon', 'add_tag', 'send_notification', 'create_todo'];

app.get("/api/automations", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM automations ORDER BY created_at DESC");
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/automations", async (req, res) => {
  try {
    const { name, trigger_type, conditions, action_type, action_data } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required." });
    if (!VALID_TRIGGERS.includes(trigger_type)) return res.status(400).json({ error: "Invalid trigger. Must be: " + VALID_TRIGGERS.join(", ") });
    if (!VALID_ACTIONS.includes(action_type)) return res.status(400).json({ error: "Invalid action. Must be: " + VALID_ACTIONS.join(", ") });
    const r = await pool.query(
      "INSERT INTO automations (name, trigger_type, conditions, action_type, action_data) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [name, trigger_type, conditions || {}, action_type, action_data || {}]
    );
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/api/automations/:id", async (req, res) => {
  try {
    const { name, trigger_type, conditions, action_type, action_data, enabled } = req.body;
    if (trigger_type && !VALID_TRIGGERS.includes(trigger_type)) return res.status(400).json({ error: "Invalid trigger." });
    if (action_type && !VALID_ACTIONS.includes(action_type)) return res.status(400).json({ error: "Invalid action." });
    const fields = []; const params = []; let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); params.push(name); }
    if (trigger_type !== undefined) { fields.push(`trigger_type = $${idx++}`); params.push(trigger_type); }
    if (conditions !== undefined) { fields.push(`conditions = $${idx++}`); params.push(JSON.stringify(conditions)); }
    if (action_type !== undefined) { fields.push(`action_type = $${idx++}`); params.push(action_type); }
    if (action_data !== undefined) { fields.push(`action_data = $${idx++}`); params.push(JSON.stringify(action_data)); }
    if (enabled !== undefined) { fields.push(`enabled = $${idx++}`); params.push(enabled); }
    if (!fields.length) return res.status(400).json({ error: "No fields." });
    params.push(req.params.id);
    const r = await pool.query(`UPDATE automations SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, params);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/automations/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM automations WHERE id = $1 RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Run automations for a trigger
async function runAutomations(triggerType, entity, entityType) {
  try {
    const rules = await pool.query("SELECT * FROM automations WHERE trigger_type = $1 AND enabled = true", [triggerType]);
    for (const rule of rules.rows) {
      const cond = rule.conditions || {};
      // Check conditions
      let match = true;
      if (cond.category && entity.category !== cond.category) match = false;
      if (cond.priority && entity.priority !== cond.priority) match = false;
      if (cond.title_contains && !(entity.title || '').toLowerCase().includes(cond.title_contains.toLowerCase())) match = false;
      if (cond.horizon && entity.horizon !== cond.horizon) match = false;
      if (!match) continue;
      // Execute action
      const data = rule.action_data || {};
      if (rule.action_type === 'set_priority' && data.priority && entity.id) {
        await pool.query("UPDATE todos SET priority = $1 WHERE id = $2", [data.priority, entity.id]);
      } else if (rule.action_type === 'set_category' && data.category && entity.id) {
        await pool.query("UPDATE todos SET category = $1 WHERE id = $2", [data.category, entity.id]);
      } else if (rule.action_type === 'set_horizon' && data.horizon && entity.id) {
        await pool.query("UPDATE todos SET horizon = $1 WHERE id = $2", [data.horizon, entity.id]);
      } else if (rule.action_type === 'add_tag' && data.tag && entity.id && entityType === 'note') {
        await pool.query("UPDATE notes SET tags = array_append(COALESCE(tags, ARRAY[]::TEXT[]), $1) WHERE id = $2 AND NOT ($1 = ANY(COALESCE(tags, ARRAY[]::TEXT[])))", [data.tag, entity.id]);
      } else if (rule.action_type === 'create_todo' && data.title) {
        await pool.query("INSERT INTO todos (title, priority, horizon, category) VALUES ($1, $2, $3, $4)", [data.title, data.priority || 'medium', data.horizon || 'short', data.category || null]);
      }
    }
  } catch (err) { console.error("Automation error:", err.message); }
}

// ============================================================================
// API — File Attachments
// ============================================================================
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer ? multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}) : null;

app.get("/api/attachments/:entityType/:entityId", async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    if (!["todo", "email", "note"].includes(entityType)) return res.status(400).json({ error: "Invalid entity type." });
    const r = await pool.query("SELECT * FROM attachments WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC", [entityType, entityId]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

if (upload) {
  app.post("/api/attachments/:entityType/:entityId", upload.single("file"), async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      if (!["todo", "email", "note"].includes(entityType)) return res.status(400).json({ error: "Invalid entity type." });
      if (!req.file) return res.status(400).json({ error: "No file uploaded." });
      const r = await pool.query(
        "INSERT INTO attachments (filename, original_name, mime_type, size_bytes, entity_type, entity_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        [req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, entityType, entityId]
      );
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
}

app.get("/api/attachments/download/:id", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM attachments WHERE id = $1", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    const filePath = path.join(uploadsDir, r.rows[0].filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found on disk." });
    res.setHeader("Content-Disposition", `attachment; filename="${r.rows[0].original_name}"`);
    res.setHeader("Content-Type", r.rows[0].mime_type);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/attachments/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM attachments WHERE id = $1 RETURNING *", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    const filePath = path.join(uploadsDir, r.rows[0].filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — Task Dependencies
// ============================================================================
app.get("/api/todos/:id/dependencies", async (req, res) => {
  try {
    const [blockedBy, blocking] = await Promise.all([
      pool.query(`SELECT td.id as dep_id, td.depends_on_id, t.title, t.completed FROM task_dependencies td JOIN todos t ON t.id = td.depends_on_id WHERE td.todo_id = $1`, [req.params.id]),
      pool.query(`SELECT td.id as dep_id, td.todo_id, t.title, t.completed FROM task_dependencies td JOIN todos t ON t.id = td.todo_id WHERE td.depends_on_id = $1`, [req.params.id]),
    ]);
    res.json({ blocked_by: blockedBy.rows, blocking: blocking.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/todos/:id/dependencies", async (req, res) => {
  try {
    const { depends_on_id } = req.body;
    if (!depends_on_id) return res.status(400).json({ error: "depends_on_id is required." });
    if (parseInt(depends_on_id) === parseInt(req.params.id)) return res.status(400).json({ error: "A task cannot depend on itself." });
    // Check both tasks exist
    const [task, dep] = await Promise.all([
      pool.query("SELECT id FROM todos WHERE id = $1 AND deleted_at IS NULL", [req.params.id]),
      pool.query("SELECT id FROM todos WHERE id = $1 AND deleted_at IS NULL", [depends_on_id]),
    ]);
    if (!task.rows.length || !dep.rows.length) return res.status(404).json({ error: "Task not found." });
    // Check for circular dependency
    const chain = await pool.query("SELECT * FROM task_dependencies WHERE todo_id = $1 AND depends_on_id = $2", [depends_on_id, req.params.id]);
    if (chain.rows.length) return res.status(400).json({ error: "Circular dependency: that task already depends on this one." });
    const r = await pool.query(
      "INSERT INTO task_dependencies (todo_id, depends_on_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *",
      [req.params.id, depends_on_id]
    );
    if (!r.rows.length) return res.status(409).json({ error: "Dependency already exists." });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/dependencies/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM task_dependencies WHERE id = $1 RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — Trash (soft-deleted items)
// ============================================================================
app.get("/api/trash", async (req, res) => {
  try {
    const [todos, emails, notes] = await Promise.all([
      pool.query("SELECT id, title, priority, horizon, deleted_at, 'todo' as type FROM todos WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"),
      pool.query("SELECT id, subject as title, recipient_name, status, deleted_at, 'email' as type FROM emails WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"),
      pool.query("SELECT id, COALESCE(title, LEFT(content, 50)) as title, deleted_at, 'note' as type FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"),
    ]);
    res.json([...todos.rows, ...emails.rows, ...notes.rows].sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/trash/:type/:id/restore", async (req, res) => {
  try {
    const { type, id } = req.params;
    const table = { todo: "todos", email: "emails", note: "notes" }[type];
    if (!table) return res.status(400).json({ error: "Invalid type. Must be: todo, email, or note" });
    const r = await pool.query(`UPDATE ${table} SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found in trash." });
    res.json({ ok: true, message: "Item restored." });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/trash/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const table = { todo: "todos", email: "emails", note: "notes" }[type];
    if (!table) return res.status(400).json({ error: "Invalid type. Must be: todo, email, or note" });
    const r = await pool.query(`DELETE FROM ${table} WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found in trash." });
    res.json({ ok: true, message: "Permanently deleted." });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/trash/empty", async (req, res) => {
  try {
    await Promise.all([
      pool.query("DELETE FROM todos WHERE deleted_at IS NOT NULL"),
      pool.query("DELETE FROM emails WHERE deleted_at IS NOT NULL"),
      pool.query("DELETE FROM notes WHERE deleted_at IS NOT NULL"),
    ]);
    res.json({ ok: true, message: "Trash emptied." });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — Email Templates
// ============================================================================
app.get("/api/email-templates", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM email_templates ORDER BY name ASC");
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/email-templates", async (req, res) => {
  try {
    const { name, subject, body } = req.body;
    if (!name || !subject || !body) return res.status(400).json({ error: "Name, subject, and body required." });
    const r = await pool.query("INSERT INTO email_templates (name, subject, body) VALUES ($1,$2,$3) RETURNING *", [name, subject, body]);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/api/email-templates/:id", async (req, res) => {
  try {
    const { name, subject, body } = req.body;
    const fields = []; const params = []; let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); params.push(name); }
    if (subject !== undefined) { fields.push(`subject = $${idx++}`); params.push(subject); }
    if (body !== undefined) { fields.push(`body = $${idx++}`); params.push(body); }
    if (!fields.length) return res.status(400).json({ error: "No fields." });
    params.push(req.params.id);
    const r = await pool.query(`UPDATE email_templates SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, params);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/email-templates/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM email_templates WHERE id = $1 RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — AI Email Drafting
// ============================================================================
app.post("/api/ai/draft-email", async (req, res) => {
  try {
    const model = await getAIModelForFeature("email_draft");
    if (model === "off") return res.status(400).json({ error: "AI email drafting is disabled. Enable it in Settings." });
    const { prompt, recipient_name } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required." });
    const text = await callAI(model, `Draft a professional email based on this request: "${prompt}"${recipient_name ? ` The recipient's name is ${recipient_name}.` : ""}

Return ONLY a JSON object with these fields:
- "subject": the email subject line
- "body": the email body text (plain text, no HTML)

Keep the tone professional but warm. Do not include any other text outside the JSON.`);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: "Failed to parse AI response." });
    const draft = JSON.parse(jsonMatch[0]);
    res.json(draft);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// API — AI Task Breakdown (generate subtasks)
// ============================================================================
app.post("/api/ai/task-breakdown", async (req, res) => {
  try {
    const model = await getAIModelForFeature("task_breakdown");
    if (model === "off") return res.status(400).json({ error: "AI task breakdown is disabled. Enable it in Settings." });
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: "Task title is required." });
    const text = await callAI(model, `Break down this task into actionable subtasks (3-8 items):

Task: "${title}"${description ? `\nDetails: "${description}"` : ""}

Return ONLY a JSON array of strings, where each string is a subtask. Keep them specific and actionable.
Example: ["Research options", "Compare prices", "Make decision"]`, 512);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: "Failed to parse AI response." });
    const subtasks = JSON.parse(jsonMatch[0]);
    res.json({ subtasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// API — AI Quick Add (parse natural language into structured todo)
// ============================================================================
app.post("/api/ai/parse-todo", async (req, res) => {
  try {
    const model = await getAIModelForFeature("quick_add");
    if (model === "off") return res.status(400).json({ error: "AI quick add is disabled." });
    const { input } = req.body;
    if (!input) return res.status(400).json({ error: "Input is required." });
    const today = new Date().toISOString().split("T")[0];
    const text = await callAI(model, `Parse this natural language task description into structured data. Today is ${today}.

Input: "${input}"

Return ONLY a JSON object with:
- "title": clean task title (remove time/priority words)
- "priority": one of "low", "medium", "high", "urgent"
- "horizon": one of "short", "medium", "long"
- "category": inferred category (e.g. "work", "personal", "health", "finance", "errands", "home") or null
- "due_date": ISO date string (YYYY-MM-DD) if a date/time is mentioned, or null

Be smart about inferring: "ASAP" = urgent, "someday" = low priority long-term, "this week" = short-term, etc.`, 256);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: "Failed to parse AI response." });
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// API — AI Weekly Review Summary
// ============================================================================
app.post("/api/ai/review-summary", async (req, res) => {
  try {
    const model = await getAIModelForFeature("review_summary");
    if (model === "off") return res.status(400).json({ error: "AI review summary is disabled." });
    const { stats } = req.body;
    if (!stats) return res.status(400).json({ error: "Stats required." });
    const text = await callAI(model, `Write a brief, encouraging weekly review summary (2-4 sentences) based on these stats:

- Tasks completed: ${stats.tasks_completed}
- Tasks created: ${stats.tasks_created}
- Emails sent: ${stats.emails_sent}
- Notes created: ${stats.notes_created}
- Overdue tasks: ${stats.overdue}
- Completed task titles: ${stats.completed_titles || "none"}

Be conversational and motivating. Highlight accomplishments. If there are overdue tasks, gently remind. Don't use emojis.`, 256);
    res.json({ summary: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// API — AI Email Tone Adjustment
// ============================================================================
app.post("/api/ai/adjust-tone", async (req, res) => {
  try {
    const model = await getAIModelForFeature("email_tone");
    if (model === "off") return res.status(400).json({ error: "AI tone adjustment is disabled." });
    const { body, tone } = req.body;
    if (!body || !tone) return res.status(400).json({ error: "Body and tone are required." });
    const text = await callAI(model, `Rewrite this email body with a "${tone}" tone. Keep the same meaning and content but adjust the language.

Original email:
${body}

Return ONLY the rewritten email body text (plain text, no JSON wrapping, no quotes).
Valid tones: more formal, more casual, shorter, friendlier, more direct.`, 1024);
    res.json({ body: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// API — AI Daily Briefing
// ============================================================================
app.get("/api/ai/daily-briefing", async (req, res) => {
  try {
    const model = await getAIModelForFeature("daily_briefing");
    if (model === "off") return res.status(400).json({ error: "AI daily briefing is disabled." });
    const today = new Date().toISOString().split("T")[0];
    const [pending, overdue, scheduled, upcoming] = await Promise.all([
      pool.query("SELECT title, priority, category, due_date FROM todos WHERE deleted_at IS NULL AND NOT completed ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 15"),
      pool.query("SELECT title, due_date FROM todos WHERE deleted_at IS NULL AND NOT completed AND due_date < $1", [today]),
      pool.query("SELECT subject, recipient_name, scheduled_at FROM emails WHERE deleted_at IS NULL AND status = 'scheduled' AND DATE(scheduled_at) = $1", [today]),
      pool.query("SELECT title, due_date FROM todos WHERE deleted_at IS NULL AND NOT completed AND due_date = $1", [today]),
    ]);
    const text = await callAI(model, `Generate a brief, helpful daily briefing (3-5 sentences) for today (${today}). Be conversational and actionable.

Today's tasks (${upcoming.rows.length}): ${upcoming.rows.map(t => t.title).join(", ") || "none"}
Overdue tasks (${overdue.rows.length}): ${overdue.rows.map(t => t.title).join(", ") || "none"}
Scheduled emails today: ${scheduled.rows.map(e => `"${e.subject}" to ${e.recipient_name}`).join(", ") || "none"}
Total pending tasks: ${pending.rows.length}
Top priorities: ${pending.rows.slice(0, 5).map(t => `${t.title} (${t.priority})`).join(", ")}

Summarize what needs attention today. Don't use emojis.`, 300);
    res.json({ briefing: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// API — AI Note Auto-Tagging
// ============================================================================
app.post("/api/ai/suggest-tags", async (req, res) => {
  try {
    const model = await getAIModelForFeature("note_tagging");
    if (model === "off") return res.status(400).json({ error: "AI note tagging is disabled." });
    const { title, content } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required." });
    const text = await callAI(model, `Suggest 1-4 short tags for this note. Tags should be lowercase single words or hyphenated phrases.

${title ? `Title: "${title}"` : ""}
Content: "${content.substring(0, 500)}"

Return ONLY a JSON array of tag strings.
Example: ["meeting-notes", "project-alpha", "action-items"]`, 128);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: "Failed to parse AI response." });
    const tags = JSON.parse(jsonMatch[0]);
    res.json({ tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// API — AI Smart Suggestions
// ============================================================================
app.get("/api/ai/smart-suggestions", async (req, res) => {
  try {
    const model = await getAIModelForFeature("daily_briefing");
    if (model === "off") return res.json({ suggestions: null });
    const todos = await pool.query("SELECT id, title, priority, horizon, category, due_date, recurring, recurrence_rule, streak_count FROM todos WHERE deleted_at IS NULL AND completed = false ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, due_date NULLS LAST LIMIT 30");
    if (!todos.rows.length) return res.json({ suggestions: null });
    const todayStr = new Date().toISOString().split("T")[0];
    const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
    const taskList = todos.rows.map(t => `- "${t.title}" [${t.priority}/${t.horizon}]${t.category ? ' ('+t.category+')' : ''}${t.due_date ? ' due:'+t.due_date.toISOString().split("T")[0] : ''}${t.recurring ? ' recurring:'+t.recurrence_rule : ''}${t.streak_count > 0 ? ' streak:'+t.streak_count : ''}`).join("\n");
    const prompt = `You are a productivity coach. Today is ${dayName}, ${todayStr}. Here are the user's pending tasks:\n${taskList}\n\nProvide exactly 3 smart suggestions as a JSON array of objects with "suggestion" (short actionable advice) and "task_ids" (array of relevant task IDs). Consider: urgency, due dates, streaks at risk, workload balance, and day of week. Focus on what to tackle NOW.\nRespond with ONLY a JSON array, no other text.`;
    const result = await callAI(model, prompt, 512);
    const cleaned = result.replace(/```json?\s*|\s*```/g, "").trim();
    const suggestions = JSON.parse(cleaned);
    res.json({ suggestions });
  } catch (err) { res.json({ suggestions: null, error: err.message }); }
});

// ============================================================================
// API — AI Natural Language Query
// ============================================================================
app.post("/api/ai/query", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query is required." });
    const model = await getAIModelForFeature("daily_briefing");
    if (model === "off") return res.json({ answer: "AI is not enabled. Enable it in Settings.", data: null });
    // Gather context
    const [todos, emails, notes] = await Promise.all([
      pool.query("SELECT id, title, priority, horizon, category, due_date, completed, completed_at, recurring, recurrence_rule, streak_count, created_at FROM todos WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 50"),
      pool.query("SELECT id, subject, recipient_name, recipient_email, status, scheduled_at, sent_at, created_at FROM emails WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 20"),
      pool.query("SELECT id, title, content, tags, pinned, created_at, updated_at FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 20"),
    ]);
    const todayStr = new Date().toISOString().split("T")[0];
    const context = `Today: ${todayStr}\n\nTasks (${todos.rows.length}):\n${todos.rows.map(t => `- [${t.completed?'done':'pending'}] "${t.title}" priority:${t.priority} horizon:${t.horizon}${t.category?' cat:'+t.category:''}${t.due_date?' due:'+t.due_date.toISOString().split("T")[0]:''}${t.completed_at?' completed:'+t.completed_at.toISOString().split("T")[0]:''}${t.recurring?' recurring:'+t.recurrence_rule:''}`).join("\n")}\n\nEmails (${emails.rows.length}):\n${emails.rows.map(e => `- [${e.status}] "${e.subject}" to:${e.recipient_name||e.recipient_email}${e.sent_at?' sent:'+e.sent_at.toISOString().split("T")[0]:''}`).join("\n")}\n\nNotes (${notes.rows.length}):\n${notes.rows.map(n => `- "${n.title||n.content.substring(0,40)}"${n.tags?' tags:'+n.tags.join(','):''}${n.pinned?' pinned':''}`).join("\n")}`;
    const prompt = `You are a personal assistant with access to the user's data. Answer their question based on the data below. Be concise and helpful. If the question asks for counts, lists, or stats, provide specific numbers.\n\nData:\n${context}\n\nUser question: "${query}"\n\nAnswer concisely:`;
    const answer = await callAI(model, prompt, 1024);
    res.json({ answer });
  } catch (err) { res.json({ answer: "Sorry, I couldn't process that query.", error: err.message }); }
});

// ============================================================================
// API — AI Model Preferences
// ============================================================================
app.get("/api/ai/models", async (req, res) => {
  try {
    const r = await pool.query("SELECT ai_model_email_draft, ai_model_task_breakdown, ai_model_quick_add, ai_model_review_summary, ai_model_email_tone, ai_model_daily_briefing, ai_model_note_tagging FROM user_settings WHERE id = 1");
    const models = r.rows[0] || {};
    models.available = !!(Anthropic && process.env.ANTHROPIC_API_KEY);
    res.json(models);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/api/ai/models", async (req, res) => {
  try {
    const allowed = ["ai_model_email_draft", "ai_model_task_breakdown", "ai_model_quick_add", "ai_model_review_summary", "ai_model_email_tone", "ai_model_daily_briefing", "ai_model_note_tagging"];
    const validValues = ["haiku", "sonnet", "off"];
    const fields = []; const params = []; let idx = 1;
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (!validValues.includes(req.body[key])) return res.status(400).json({ error: `Invalid value for ${key}: must be haiku, sonnet, or off` });
        fields.push(`${key} = $${idx++}`);
        params.push(req.body[key]);
      }
    }
    if (!fields.length) return res.status(400).json({ error: "No fields to update." });
    const r = await pool.query(`UPDATE user_settings SET ${fields.join(", ")} WHERE id = 1 RETURNING *`, params);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — Todo Categories (list distinct categories)
// ============================================================================
app.get("/api/todo-categories", async (req, res) => {
  try {
    const r = await pool.query("SELECT DISTINCT category FROM todos WHERE deleted_at IS NULL AND category IS NOT NULL AND category != '' ORDER BY category");
    const defaults = ["work", "personal", "health", "finance", "errands", "home", "learning"];
    const dbCats = r.rows.map(row => row.category);
    const all = [...new Set([...defaults, ...dbCats])].sort();
    res.json(all);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — Global Search
// ============================================================================
app.get("/api/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    const pattern = `%${q}%`;
    const [todos, emails, notes, contacts] = await Promise.all([
      pool.query("SELECT id, title, description, priority, horizon, 'todo' as type FROM todos WHERE deleted_at IS NULL AND (title ILIKE $1 OR description ILIKE $1) LIMIT 10", [pattern]),
      pool.query("SELECT id, subject as title, recipient_name as description, status as priority, 'email' as type FROM emails WHERE deleted_at IS NULL AND (subject ILIKE $1 OR body ILIKE $1 OR recipient_name ILIKE $1) LIMIT 10", [pattern]),
      pool.query("SELECT id, COALESCE(title, LEFT(content, 50)) as title, LEFT(content, 100) as description, 'note' as type FROM notes WHERE deleted_at IS NULL AND (title ILIKE $1 OR content ILIKE $1) LIMIT 10", [pattern]),
      pool.query("SELECT id, name as title, email as description, 'contact' as type FROM contacts WHERE name ILIKE $1 OR email ILIKE $1 LIMIT 10", [pattern]),
    ]);
    res.json([...todos.rows, ...emails.rows, ...notes.rows, ...contacts.rows]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — Calendar events
// ============================================================================
app.get("/api/calendar", async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month, 10) || new Date().getMonth() + 1;
    const y = parseInt(year, 10) || new Date().getFullYear();
    const startDate = `${y}-${String(m).padStart(2,"0")}-01`;
    const endDate = m === 12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,"0")}-01`;
    const [todos, emails, notes] = await Promise.all([
      pool.query("SELECT id, title, due_date as event_date, priority, 'todo' as type FROM todos WHERE deleted_at IS NULL AND due_date >= $1 AND due_date < $2 AND NOT completed", [startDate, endDate]),
      pool.query("SELECT id, subject as title, scheduled_at as event_date, status as priority, 'email' as type FROM emails WHERE deleted_at IS NULL AND scheduled_at >= $1 AND scheduled_at < $2", [startDate, endDate]),
      pool.query("SELECT id, COALESCE(title, LEFT(content,30)) as title, reminder_at as event_date, 'note' as type FROM notes WHERE deleted_at IS NULL AND reminder_at >= $1 AND reminder_at < $2", [startDate, endDate]),
    ]);
    res.json([...todos.rows, ...emails.rows, ...notes.rows]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — iCal Export
// ============================================================================
app.get("/api/calendar.ics", async (req, res) => {
  try {
    const [todos, emails] = await Promise.all([
      pool.query("SELECT id, title, description, due_date, priority FROM todos WHERE deleted_at IS NULL AND due_date IS NOT NULL AND completed = false ORDER BY due_date"),
      pool.query("SELECT id, subject, recipient_email, scheduled_at FROM emails WHERE deleted_at IS NULL AND scheduled_at IS NOT NULL AND status = 'scheduled' ORDER BY scheduled_at"),
    ]);
    let ical = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Per-sistant//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:Per-sistant Tasks\r\n";
    for (const t of todos.rows) {
      const d = new Date(t.due_date);
      const dateStr = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const dateOnly = dateStr.substring(0, 8);
      ical += `BEGIN:VEVENT\r\nUID:todo-${t.id}@per-sistant\r\nDTSTART;VALUE=DATE:${dateOnly}\r\nDTEND;VALUE=DATE:${dateOnly}\r\nSUMMARY:[${t.priority.toUpperCase()}] ${t.title.replace(/[\\,;]/g, " ")}\r\n${t.description ? "DESCRIPTION:" + t.description.replace(/\n/g, "\\n").replace(/[\\,;]/g, " ") + "\r\n" : ""}END:VEVENT\r\n`;
    }
    for (const e of emails.rows) {
      const d = new Date(e.scheduled_at);
      const dateStr = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      ical += `BEGIN:VEVENT\r\nUID:email-${e.id}@per-sistant\r\nDTSTART:${dateStr}\r\nDTEND:${dateStr}\r\nSUMMARY:Email: ${e.subject.replace(/[\\,;]/g, " ")}\r\nDESCRIPTION:To: ${e.recipient_email}\r\nEND:VEVENT\r\n`;
    }
    ical += "END:VCALENDAR\r\n";
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="per-sistant.ics"');
    res.send(ical);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — Weekly Review
// ============================================================================
app.get("/api/review", async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const ws = weekStart.toISOString().split("T")[0];
    const we = weekEnd.toISOString().split("T")[0];
    const [completed, created, sent, notesCreated, upcoming, overdue] = await Promise.all([
      pool.query("SELECT * FROM todos WHERE deleted_at IS NULL AND completed_at >= $1 AND completed_at < $2 ORDER BY completed_at DESC", [ws, we]),
      pool.query("SELECT count(*) as cnt FROM todos WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2", [ws, we]),
      pool.query("SELECT count(*) as cnt FROM emails WHERE deleted_at IS NULL AND sent_at >= $1 AND sent_at < $2", [ws, we]),
      pool.query("SELECT count(*) as cnt FROM notes WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2", [ws, we]),
      pool.query("SELECT * FROM todos WHERE deleted_at IS NULL AND due_date >= $1 AND due_date < $2 AND NOT completed ORDER BY due_date", [we, new Date(weekEnd.getTime() + 7*86400000).toISOString().split("T")[0]]),
      pool.query("SELECT * FROM todos WHERE deleted_at IS NULL AND due_date < $1 AND NOT completed ORDER BY due_date", [ws]),
    ]);
    res.json({
      week_start: ws, week_end: we,
      tasks_completed: completed.rows,
      tasks_created_count: parseInt(created.rows[0].cnt, 10),
      emails_sent_count: parseInt(sent.rows[0].cnt, 10),
      notes_created_count: parseInt(notesCreated.rows[0].cnt, 10),
      upcoming_tasks: upcoming.rows,
      overdue_tasks: overdue.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// API — Perfin integration (proxy)
// ============================================================================
app.get("/api/perfin/stats", async (req, res) => {
  const perfinUrl = PERFIN_URL || (await pool.query("SELECT perfin_url FROM user_settings WHERE id = 1").catch(() => ({rows:[]}))).rows[0]?.perfin_url;
  if (!perfinUrl) return res.json({ connected: false });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(`${perfinUrl}/api/subscriptions?filter=active`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!r.ok) return res.json({ connected: false });
    const subs = await r.json();
    const totalMonthly = subs.filter(s => s.cadence_days <= 31).reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    const upcoming = subs.filter(s => {
      const next = new Date(s.next_expected);
      const now = new Date();
      const diff = (next - now) / 86400000;
      return diff >= 0 && diff <= 7;
    });
    res.json({ connected: true, total_subscriptions: subs.length, monthly_cost: totalMonthly.toFixed(2), upcoming_this_week: upcoming.length, upcoming });
  } catch {
    res.json({ connected: false });
  }
});

// ============================================================================
// API — Todo reorder (drag-and-drop)
// ============================================================================
app.post("/api/todos/reorder", async (req, res) => {
  try {
    const { order } = req.body; // array of {id, sort_order}
    if (!Array.isArray(order)) return res.status(400).json({ error: "order array required." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const item of order) {
        await client.query("UPDATE todos SET sort_order = $1 WHERE id = $2", [item.sort_order, item.id]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally { client.release(); }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// Page — Dashboard
// ============================================================================
app.get("/", async (req, res) => {
  res.send(`${pageHead("Dashboard")}
<body>
${themeScript()}
<div class="container">
  ${navBar("/")}
  <div style="display:flex;align-items:center;justify-content:space-between;">
    <div><h1>Dashboard</h1><p class="subtitle" style="margin-bottom:0;">Your personal command center</p></div>
    <button id="customize-btn" onclick="toggleCustomize()" style="padding:6px 14px;font-size:10px;font-weight:500;letter-spacing:0.5px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:transparent;color:var(--text-muted);font-family:inherit;text-transform:uppercase;">Customize</button>
  </div>
  <div style="margin-bottom:36px;"></div>

  <!-- Customization panel -->
  <div id="customize-panel" style="display:none;margin-bottom:24px;padding:16px;border-radius:var(--radius);background:var(--surface);border:1px solid var(--warm);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <span style="font-size:10px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;">Widget Visibility &amp; Order</span>
      <button onclick="resetLayout()" style="padding:4px 10px;font-size:10px;font-weight:500;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:transparent;color:var(--text-muted);font-family:inherit;">Reset</button>
    </div>
    <div id="widget-toggles" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
    <div style="margin-top:10px;font-size:10px;color:var(--text-muted);">Drag widgets below to reorder. Click toggles above to show/hide.</div>
  </div>

  <div id="dash-widgets">
    <!-- Search widget -->
    <div class="dash-widget" data-widget="search" draggable="true" ondragstart="wdragStart(event)" ondragover="wdragOver(event)" ondrop="wdrop(event)" ondragend="wdragEnd(event)">
      <div class="search-bar">
        <span class="search-icon">&#128269;</span>
        <input type="text" id="global-search" placeholder="Search todos, emails, notes, contacts... (press /)" oninput="doSearch(this.value)">
      </div>
      <div class="section search-results" id="search-results" style="display:none;margin-bottom:24px;"></div>
    </div>

    <!-- Cards widget -->
    <div class="dash-widget" data-widget="cards" draggable="true" ondragstart="wdragStart(event)" ondragover="wdragOver(event)" ondrop="wdrop(event)" ondragend="wdragEnd(event)">
      <div class="top-cards" id="cards"></div>
    </div>

    <!-- AI Daily Briefing widget -->
    <div class="dash-widget" data-widget="briefing" draggable="true" ondragstart="wdragStart(event)" ondragover="wdragOver(event)" ondrop="wdrop(event)" ondragend="wdragEnd(event)">
      <div id="briefing-section" style="display:none;margin-bottom:24px;">
        <div class="section">
          <h2>Today's Briefing</h2>
          <div id="briefing-content" style="font-size:14px;font-weight:300;line-height:1.7;"></div>
        </div>
      </div>
    </div>

    <!-- AI Smart Suggestions widget -->
    <div class="dash-widget" data-widget="suggestions" draggable="true" ondragstart="wdragStart(event)" ondragover="wdragOver(event)" ondrop="wdrop(event)" ondragend="wdragEnd(event)">
      <div id="suggestions-section" style="display:none;margin-bottom:24px;">
        <div class="section">
          <h2>Smart Suggestions</h2>
          <div id="suggestions-content"></div>
        </div>
      </div>
    </div>

    <!-- AI Natural Language Query widget -->
    <div class="dash-widget" data-widget="ai_query" draggable="true" ondragstart="wdragStart(event)" ondragover="wdragOver(event)" ondrop="wdrop(event)" ondragend="wdragEnd(event)">
      <div class="section" style="margin-bottom:24px;">
        <h2>Ask Your Assistant</h2>
        <div style="display:flex;gap:8px;">
          <input type="text" id="ai-query-input" placeholder="Ask anything... &quot;What did I do last week?&quot; &quot;How many tasks are overdue?&quot;" style="flex:1;padding:10px 14px;font-size:13px;font-family:inherit;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);outline:none;" onkeydown="if(event.key==='Enter')askAI()">
          <button onclick="askAI()" style="padding:10px 18px;font-size:12px;font-weight:500;letter-spacing:0.5px;border:1px solid var(--teal);border-radius:8px;cursor:pointer;background:transparent;color:var(--teal);font-family:inherit;text-transform:uppercase;">Ask</button>
        </div>
        <div id="ai-query-answer" style="display:none;margin-top:12px;padding:12px 16px;background:var(--surface-2);border-radius:8px;font-size:13px;font-weight:300;line-height:1.6;white-space:pre-wrap;"></div>
      </div>
    </div>

    <!-- Task Overview widget -->
    <div class="dash-widget" data-widget="tasks" draggable="true" ondragstart="wdragStart(event)" ondragover="wdragOver(event)" ondrop="wdrop(event)" ondragend="wdragEnd(event)">
      <div class="section" style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <h2 style="margin-bottom:0;">Task Overview</h2>
        </div>
        <div class="filters" id="dash-task-filters">
          <button class="active" onclick="setDashView(this,'all')">All</button>
          <button onclick="setDashView(this,'category')">By Category</button>
          <button onclick="setDashView(this,'urgency')">By Urgency</button>
          <button onclick="setDashView(this,'due')">Due Soon</button>
        </div>
        <div id="dash-tasks"></div>
      </div>
    </div>

    <!-- Upcoming + Emails widget -->
    <div class="dash-widget" data-widget="upcoming_emails" draggable="true" ondragstart="wdragStart(event)" ondragover="wdragOver(event)" ondrop="wdrop(event)" ondragend="wdragEnd(event)">
      <div class="dash-two-col" style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div class="section">
          <h2>Upcoming Tasks</h2>
          <div id="upcoming-tasks"></div>
        </div>
        <div class="section">
          <h2>Scheduled Emails</h2>
          <div id="scheduled-emails"></div>
        </div>
      </div>
    </div>

    <!-- Perfin widget -->
    <div class="dash-widget" data-widget="perfin" draggable="true" ondragstart="wdragStart(event)" ondragover="wdragOver(event)" ondrop="wdrop(event)" ondragend="wdragEnd(event)">
      <div id="perfin-section" style="display:none;margin-top:24px;">
        <div class="section">
          <h2>Perfin — Financial Overview</h2>
          <div id="perfin-data"></div>
        </div>
      </div>
    </div>

    <!-- Shortcuts widget -->
    <div class="dash-widget" data-widget="shortcuts" draggable="true" ondragstart="wdragStart(event)" ondragover="wdragOver(event)" ondrop="wdrop(event)" ondragend="wdragEnd(event)">
      <div style="margin-top:24px;text-align:center;">
        <p style="font-size:11px;color:var(--text-muted);">Keyboard shortcuts: <span class="kbd">/</span> Search &middot; <span class="kbd">N</span> New task &middot; <span class="kbd">E</span> New email &middot; <span class="kbd">?</span> Show all</p>
      </div>
    </div>
  </div>
</div>
<script>
var searchTimeout = null;
function doSearch(q) {
  clearTimeout(searchTimeout);
  if (!q || q.length < 2) { document.getElementById('search-results').style.display='none'; return; }
  searchTimeout = setTimeout(async function() {
    var results = await fetch('/api/search?q='+encodeURIComponent(q)).then(r=>r.json());
    if (!results.length) { document.getElementById('search-results').innerHTML='<div class="empty-msg">No results</div>'; }
    else {
      document.getElementById('search-results').innerHTML = results.map(r => {
        var href = r.type==='todo'?'/todos':r.type==='email'?'/emails':r.type==='note'?'/notes':'/contacts';
        return '<a href="'+href+'" class="result-item" style="display:block;text-decoration:none;color:inherit;"><div class="result-type">'+r.type+'</div><div style="font-size:14px;">'+esc(r.title||'')+'</div>'+(r.description?'<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">'+esc(r.description)+'</div>':'')+'</a>';
      }).join('');
    }
    document.getElementById('search-results').style.display='block';
  }, 300);
}

var dashView = 'all';
var allTodos = [];
function setDashView(btn, v) { dashView = v; document.querySelectorAll('#dash-task-filters button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderDashTasks(); }

function renderDashTasks() {
  var container = document.getElementById('dash-tasks');
  if (!allTodos.length) { container.innerHTML = '<div class="empty-msg">No pending tasks</div>'; return; }
  var html = '';
  if (dashView === 'category') {
    var cats = {};
    allTodos.forEach(t => { var c = t.category || 'Uncategorized'; if (!cats[c]) cats[c] = []; cats[c].push(t); });
    Object.keys(cats).sort().forEach(c => {
      html += '<div style="margin-bottom:16px;"><div style="font-size:10px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border);">'+esc(c)+' ('+cats[c].length+')</div>';
      cats[c].slice(0,5).forEach(t => { html += renderDashTodo(t); });
      if (cats[c].length > 5) html += '<div style="font-size:11px;color:var(--text-muted);padding:4px 0;">+'+(cats[c].length-5)+' more</div>';
      html += '</div>';
    });
  } else if (dashView === 'urgency') {
    ['urgent','high','medium','low'].forEach(p => {
      var items = allTodos.filter(t=>t.priority===p);
      if (!items.length) return;
      html += '<div style="margin-bottom:16px;"><div style="font-size:10px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border);">'+p+' ('+items.length+')</div>';
      items.slice(0,5).forEach(t => { html += renderDashTodo(t); });
      if (items.length > 5) html += '<div style="font-size:11px;color:var(--text-muted);padding:4px 0;">+'+(items.length-5)+' more</div>';
      html += '</div>';
    });
  } else if (dashView === 'due') {
    var withDue = allTodos.filter(t=>t.due_date).sort((a,b)=>new Date(a.due_date)-new Date(b.due_date));
    if (!withDue.length) { container.innerHTML = '<div class="empty-msg">No tasks with due dates</div>'; return; }
    withDue.slice(0,10).forEach(t => { html += renderDashTodo(t); });
  } else {
    allTodos.slice(0,10).forEach(t => { html += renderDashTodo(t); });
    if (allTodos.length > 10) html += '<div style="font-size:11px;color:var(--text-muted);padding:8px 0;text-align:center;"><a href="/todos">View all '+allTodos.length+' tasks &rarr;</a></div>';
  }
  container.innerHTML = html;
}

function renderDashTodo(t) {
  var overdue = t.due_date && new Date(t.due_date) <= new Date() ? ' style="color:var(--red)"' : '';
  var completeBtn = t.recurring
    ? '<button onclick="event.stopPropagation();dashCompleteRecurring('+t.id+')" title="Complete & create next" style="background:none;border:1px solid var(--green);color:var(--green);width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">&#10003;</button>'
    : '<button onclick="event.stopPropagation();dashComplete('+t.id+')" title="Mark complete" style="background:none;border:1px solid var(--green);color:var(--green);width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">&#10003;</button>';
  var streakBadge = t.recurring && t.streak_count > 0 ? '<span class="badge streak">&#x1F525; '+t.streak_count+'</span>' : '';
  return '<div class="todo-item" style="display:flex;align-items:center;gap:10px;">'+completeBtn+'<div class="todo-content" style="flex:1;"><div class="todo-title">'+esc(t.title)+'</div><div class="todo-meta"><span class="badge '+t.priority+'">'+t.priority+'</span>'+(t.category?'<span>'+esc(t.category)+'</span>':'')+(t.due_date?'<span'+overdue+'>Due: '+new Date(t.due_date).toLocaleDateString()+'</span>':'')+(t.recurring?'<span class="badge recurring">recurring</span>':'')+streakBadge+'</div></div></div>';
}

async function dashComplete(id) {
  await fetch('/api/todos/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:true})});
  allTodos = allTodos.filter(t=>t.id!==id);
  renderDashTasks();
}

async function dashCompleteRecurring(id) {
  await fetch('/api/todos/'+id+'/complete-recurring', {method:'POST'});
  allTodos = await fetch('/api/todos?completed=false&limit=50').then(r=>r.json());
  renderDashTasks();
}

async function dashSendEmail(id) {
  var r = await fetch('/api/emails/'+id+'/send', {method:'POST'}).then(r=>r.json());
  if (r.ok) { load(); } else { alert('Failed: '+(r.error||'Unknown error')); }
}

async function load() {
  const stats = await fetch('/api/stats').then(r=>r.json());
  document.getElementById('cards').innerHTML = [
    {label:'Pending Tasks',value:stats.todos.pending,cls:'warm'},
    {label:'Urgent',value:stats.todos.urgent,cls:'red'},
    {label:'Overdue',value:stats.todos.overdue,cls:stats.todos.overdue > 0 ? 'red' : 'green'},
    {label:'Completed',value:stats.todos.done,cls:'green'},
    {label:'Email Drafts',value:stats.emails.drafts,cls:'blue'},
    {label:'Scheduled',value:stats.emails.scheduled,cls:'yellow'},
    {label:'Emails Sent',value:stats.emails.sent,cls:'teal'},
    {label:'Notes',value:stats.notes.total,cls:'warm'},
  ].map(c => '<div class="card"><div class="label">'+c.label+'</div><div class="value '+c.cls+'">'+c.value+'</div></div>').join('');

  allTodos = await fetch('/api/todos?completed=false&limit=50').then(r=>r.json());
  renderDashTasks();

  const upcoming = allTodos.filter(t=>t.due_date).sort((a,b)=>new Date(a.due_date)-new Date(b.due_date)).slice(0,5);
  document.getElementById('upcoming-tasks').innerHTML = upcoming.length
    ? upcoming.map(t => '<div class="todo-item"><div class="todo-content"><div class="todo-title">'+esc(t.title)+'</div><div class="todo-meta"><span class="badge '+t.priority+'">'+t.priority+'</span>'+(t.recurring?'<span class="badge recurring">recurring</span>':'')+'<span>Due: '+new Date(t.due_date).toLocaleDateString()+'</span></div></div></div>').join('')
    : '<div class="empty-msg">No upcoming tasks with due dates</div>';

  const emails = await fetch('/api/emails?status=scheduled').then(r=>r.json());
  document.getElementById('scheduled-emails').innerHTML = emails.length
    ? emails.slice(0,5).map(e => '<div class="todo-item" style="display:flex;align-items:center;gap:10px;"><button onclick="event.stopPropagation();dashSendEmail('+e.id+')" title="Send now" style="background:none;border:1px solid var(--blue);color:var(--blue);padding:2px 8px;border-radius:6px;cursor:pointer;font-size:11px;flex-shrink:0;font-family:inherit;">Send</button><div class="todo-content" style="flex:1;"><div class="todo-title">'+esc(e.subject)+'</div><div class="todo-meta"><span>To: '+esc(e.recipient_name||e.recipient_email)+'</span><span>'+new Date(e.scheduled_at).toLocaleString()+'</span></div></div></div>').join('')
    : '<div class="empty-msg">No scheduled emails</div>';

  // Load Perfin data
  try {
    var perfin = await fetch('/api/perfin/stats').then(r=>r.json());
    if (perfin.connected) {
      document.getElementById('perfin-section').style.display='block';
      var html = '<div class="top-cards" style="margin-bottom:0">';
      html += '<div class="card"><div class="label">Active Subscriptions</div><div class="value teal">'+perfin.total_subscriptions+'</div></div>';
      html += '<div class="card"><div class="label">Monthly Cost</div><div class="value warm">$'+perfin.monthly_cost+'</div></div>';
      html += '<div class="card"><div class="label">Renewing This Week</div><div class="value '+(perfin.upcoming_this_week>0?'yellow':'green')+'">'+perfin.upcoming_this_week+'</div></div>';
      html += '</div>';
      if (perfin.upcoming && perfin.upcoming.length) {
        html += '<div style="margin-top:16px;">';
        perfin.upcoming.forEach(s => {
          html += '<div class="todo-item"><div class="todo-content"><div class="todo-title">'+esc(s.display_name||s.merchant_key)+'</div><div class="todo-meta"><span>$'+parseFloat(s.amount).toFixed(2)+'</span><span>Due: '+new Date(s.next_expected).toLocaleDateString()+'</span></div></div></div>';
        });
        html += '</div>';
      }
      document.getElementById('perfin-data').innerHTML = html;
    }
  } catch {}

  // Load AI daily briefing (non-blocking)
  fetch('/api/ai/daily-briefing').then(r=>r.json()).then(d => {
    if (d.briefing) {
      document.getElementById('briefing-content').textContent = d.briefing;
      document.getElementById('briefing-section').style.display = 'block';
    }
  }).catch(function(){});

  // Load AI smart suggestions (non-blocking)
  fetch('/api/ai/smart-suggestions').then(r=>r.json()).then(d => {
    if (d.suggestions && d.suggestions.length) {
      document.getElementById('suggestions-content').innerHTML = d.suggestions.map(s =>
        '<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;font-weight:300;line-height:1.5;">'+
        '<span style="color:var(--teal);margin-right:8px;">&#9733;</span>'+esc(s.suggestion)+'</div>'
      ).join('');
      document.getElementById('suggestions-section').style.display = 'block';
    }
  }).catch(function(){});
}

async function askAI() {
  var input = document.getElementById('ai-query-input');
  var q = input.value.trim();
  if (!q) return;
  var answerEl = document.getElementById('ai-query-answer');
  answerEl.textContent = 'Thinking...';
  answerEl.style.display = 'block';
  try {
    var r = await fetch('/api/ai/query', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})}).then(r=>r.json());
    answerEl.textContent = r.answer || 'No answer available.';
  } catch (err) { answerEl.textContent = 'Error: '+err.message; }
}

// Dashboard widget customization
var widgetNames = {search:'Search',cards:'Stats Cards',briefing:'AI Briefing',suggestions:'Smart Suggestions',ai_query:'Ask AI',tasks:'Task Overview',upcoming_emails:'Upcoming & Emails',perfin:'Perfin',shortcuts:'Shortcuts'};
var dashLayout = {widgets:['search','cards','briefing','suggestions','ai_query','tasks','upcoming_emails','perfin','shortcuts'],hidden:[]};
var wdragSrcWidget = null;

async function loadLayout() {
  try {
    var settings = await fetch('/api/settings').then(r=>r.json());
    if (settings.dashboard_layout) dashLayout = settings.dashboard_layout;
  } catch {}
  applyLayout();
}

function applyLayout() {
  var container = document.getElementById('dash-widgets');
  var widgets = container.querySelectorAll('.dash-widget');
  var map = {};
  widgets.forEach(w => { map[w.dataset.widget] = w; });
  // Reorder
  dashLayout.widgets.forEach(id => { if (map[id]) container.appendChild(map[id]); });
  // Show/hide
  widgets.forEach(w => {
    w.style.display = dashLayout.hidden.includes(w.dataset.widget) ? 'none' : 'block';
  });
  renderToggles();
}

function renderToggles() {
  var html = '';
  dashLayout.widgets.forEach(id => {
    var hidden = dashLayout.hidden.includes(id);
    html += '<button onclick="toggleWidget(\\''+id+'\\');event.stopPropagation();" style="padding:4px 12px;font-size:10px;font-weight:500;border-radius:20px;cursor:pointer;font-family:inherit;border:1px solid '+(hidden?'var(--border)':'var(--warm)')+';background:'+(hidden?'transparent':'rgba(212,165,116,0.1)')+';color:'+(hidden?'var(--text-muted)':'var(--warm)')+';">'+(widgetNames[id]||id)+'</button>';
  });
  document.getElementById('widget-toggles').innerHTML = html;
}

function toggleWidget(id) {
  var idx = dashLayout.hidden.indexOf(id);
  if (idx > -1) dashLayout.hidden.splice(idx, 1);
  else dashLayout.hidden.push(id);
  applyLayout();
  saveLayout();
}

function toggleCustomize() {
  var panel = document.getElementById('customize-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  document.getElementById('customize-btn').textContent = panel.style.display === 'none' ? 'Customize' : 'Done';
}

function resetLayout() {
  dashLayout = {widgets:['search','cards','briefing','tasks','upcoming_emails','perfin','shortcuts'],hidden:[]};
  applyLayout();
  saveLayout();
}

async function saveLayout() {
  await fetch('/api/settings', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({dashboard_layout:dashLayout})});
}

function wdragStart(e) { wdragSrcWidget = e.currentTarget.dataset.widget; e.currentTarget.style.opacity = '0.4'; }
function wdragOver(e) { e.preventDefault(); e.currentTarget.style.borderTop = '2px solid var(--warm)'; }
function wdragEnd(e) { document.querySelectorAll('.dash-widget').forEach(w => { w.style.opacity = '1'; w.style.borderTop = ''; }); }
function wdrop(e) {
  e.preventDefault(); e.currentTarget.style.borderTop = '';
  var target = e.currentTarget.dataset.widget;
  if (wdragSrcWidget === target) return;
  var srcIdx = dashLayout.widgets.indexOf(wdragSrcWidget);
  var tgtIdx = dashLayout.widgets.indexOf(target);
  if (srcIdx > -1 && tgtIdx > -1) {
    dashLayout.widgets.splice(srcIdx, 1);
    dashLayout.widgets.splice(tgtIdx, 0, wdragSrcWidget);
    applyLayout();
    saveLayout();
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === '/') { e.preventDefault(); document.getElementById('global-search').focus(); }
  else if (e.key === 'n' || e.key === 'N') { location.href = '/todos'; }
  else if (e.key === 'e' || e.key === 'E') { location.href = '/emails'; }
  else if (e.key === 'c' || e.key === 'C') { location.href = '/calendar'; }
  else if (e.key === 'r' || e.key === 'R') { location.href = '/review'; }
});

loadLayout();
load();
</script>
</body></html>`);
});

// ============================================================================
// Page — Todos
// ============================================================================
app.get("/todos", (req, res) => {
  res.send(`${pageHead("To-Dos")}
<body>
${themeScript()}
<div class="container">
  ${navBar("/todos")}
  <h1>To-Dos</h1>
  <p class="subtitle">Short, medium, and long-term task management</p>

  <div class="actions">
    <button class="primary" onclick="openAdd()">+ New Task</button>
    <button onclick="openQuickTodo()">Quick Add</button>
    <button id="select-toggle" onclick="toggleSelectMode()">Select</button>
  </div>
  <div id="bulk-bar" style="display:none;padding:10px 16px;margin-bottom:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);display:none;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;">
    <span id="bulk-count">0 selected</span>
    <button onclick="bulkAction('complete')" style="background:var(--green-bg);color:var(--green);border:1px solid var(--green);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;">Complete</button>
    <button onclick="bulkAction('delete')" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;">Delete</button>
    <select id="bulk-priority" onchange="if(this.value)bulkAction('set_priority',{priority:this.value});this.value='';" style="padding:4px 8px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);">
      <option value="">Set Priority...</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
    </select>
    <button onclick="selectAll()" style="margin-left:auto;background:none;border:1px solid var(--border);color:var(--text-muted);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit;">Select All</button>
  </div>

  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;font-weight:500;">
    <span style="padding:6px 0;">View:</span>
  </div>
  <div class="filters" id="horizon-filters">
    <button class="active" onclick="setHorizon(this,'')">All</button>
    <button onclick="setHorizon(this,'short')">Short-term</button>
    <button onclick="setHorizon(this,'medium')">Medium-term</button>
    <button onclick="setHorizon(this,'long')">Long-term</button>
  </div>
  <div class="filters" id="status-filters">
    <button class="active" onclick="setStatus(this,'pending')">Pending</button>
    <button onclick="setStatus(this,'all')">All</button>
    <button onclick="setStatus(this,'done')">Completed</button>
  </div>
  <div class="filters" id="priority-filters">
    <button class="active" onclick="setPriority(this,'')">Any Priority</button>
    <button onclick="setPriority(this,'urgent')">Urgent</button>
    <button onclick="setPriority(this,'high')">High</button>
    <button onclick="setPriority(this,'medium')">Medium</button>
    <button onclick="setPriority(this,'low')">Low</button>
  </div>
  <div class="filters" id="category-filters">
    <button class="active" onclick="setCategory(this,'')">All Categories</button>
  </div>

  <div class="section">
    <div id="todo-list"></div>
  </div>
</div>

<!-- Add/Edit Modal -->
<div class="modal-overlay" id="modal">
  <div class="modal">
    <h2 id="modal-title">New Task</h2>
    <input type="hidden" id="edit-id">
    <label>Title</label>
    <input type="text" id="f-title" placeholder="What needs to be done?">
    <label>Description</label>
    <textarea id="f-desc" placeholder="Optional details..."></textarea>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div><label>Priority</label>
        <select id="f-priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select>
      </div>
      <div><label>Horizon</label>
        <select id="f-horizon"><option value="short">Short-term</option><option value="medium">Medium-term</option><option value="long">Long-term</option></select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div><label>Category</label>
        <select id="f-category-select" onchange="if(this.value==='__custom__'){document.getElementById('f-category-custom').style.display='block';document.getElementById('f-category-custom').focus();}else{document.getElementById('f-category-custom').style.display='none';}">
          <option value="">None</option>
          <option value="__custom__">Custom...</option>
        </select>
        <input type="text" id="f-category-custom" placeholder="Type custom category" style="display:none;margin-top:6px;">
      </div>
      <div><label>Due Date</label>
        <input type="date" id="f-due"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div style="margin-top:12px;">
        <label style="display:inline;cursor:pointer">
          <input type="checkbox" id="f-recurring" style="width:auto;margin-right:6px;" onchange="document.getElementById('f-recurrence').style.display=this.checked?'block':'none'"> Recurring task
        </label>
      </div>
      <div id="f-recurrence" style="display:none;">
        <label>Repeat</label>
        <select id="f-recurrence-rule"><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>
      </div>
    </div>
    <div id="subtasks-section" style="display:none;margin-top:16px;">
      <label>Subtasks <button onclick="aiBreakdown()" id="ai-breakdown-btn" style="float:right;padding:4px 10px;font-size:10px;font-weight:500;border:1px solid var(--teal);border-radius:6px;cursor:pointer;background:transparent;color:var(--teal);font-family:inherit;text-transform:uppercase;letter-spacing:0.5px;">AI Breakdown</button></label>
      <div id="subtask-list-edit"></div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <input type="text" id="new-subtask" placeholder="Add subtask..." style="flex:1">
        <button onclick="addSubtask()" style="padding:8px 16px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;">Add</button>
      </div>
    </div>
    <!-- Location reminder (edit mode only) -->
    <div id="location-section" style="display:none;margin-top:16px;">
      <label>Location Reminder</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="f-location-name" placeholder="e.g. Home, Office, Grocery Store" style="flex:1">
        <button onclick="getLocation()" title="Use current location" style="padding:10px 14px;font-size:14px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:transparent;color:var(--teal);flex-shrink:0;">&#128205;</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;">
        <input type="number" step="any" id="f-location-lat" placeholder="Latitude" style="font-size:11px;">
        <input type="number" step="any" id="f-location-lng" placeholder="Longitude" style="font-size:11px;">
        <input type="number" id="f-location-radius" placeholder="Radius (m)" value="200" style="font-size:11px;">
      </div>
      <div id="location-status" style="font-size:10px;color:var(--text-muted);margin-top:4px;"></div>
    </div>
    <!-- Dependencies section (edit mode only) -->
    <div id="deps-section" style="display:none;margin-top:16px;">
      <label>Dependencies</label>
      <div id="deps-list" style="margin-bottom:8px;"></div>
      <div style="display:flex;gap:8px;">
        <select id="dep-select" style="flex:1"><option value="">Select a task this depends on...</option></select>
        <button onclick="addDep()" style="padding:8px 16px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;">Add</button>
      </div>
    </div>
    <div class="modal-actions">
      <button onclick="closeModal()">Cancel</button>
      <button class="primary" onclick="saveTodo()">Save</button>
      <button class="danger" id="delete-btn" style="display:none" onclick="deleteTodo()">Delete</button>
    </div>
  </div>
</div>

<!-- Quick Add Modal (natural language) -->
<div class="modal-overlay" id="quick-todo-modal">
  <div class="modal">
    <h2>Quick Add Task</h2>
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px;">
      Examples: "Buy groceries tomorrow" &middot; "Call dentist Friday at 2PM" &middot; "Finish report by March 20"
    </p>
    <label>What needs to be done?</label>
    <div style="display:flex;gap:8px;">
      <input type="text" id="qt-input" placeholder="Type or speak a task..." onkeydown="if(event.key==='Enter')parseQuickTodo()" style="flex:1">
      <button onclick="startVoiceInput('qt-input')" title="Voice input" style="padding:10px 14px;font-size:16px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);flex-shrink:0;">&#127908;</button>
    </div>
    <div id="qt-preview" style="display:none;margin-top:16px;" class="section">
      <h2>Preview</h2>
      <div id="qt-preview-content"></div>
    </div>
    <div class="modal-actions">
      <button onclick="closeQuickTodo()">Cancel</button>
      <button class="primary" onclick="parseQuickTodoAI()">Parse</button>
      <button class="primary" id="qt-confirm" style="display:none" onclick="confirmQuickTodo()">Create</button>
    </div>
  </div>
</div>

<script>
var curHorizon = '', curStatus = 'pending', curPriority = '', curCategory = '';
var dragSrcId = null;
var selectMode = false, selectedIds = new Set();

function toggleSelectMode() {
  selectMode = !selectMode;
  selectedIds.clear();
  document.getElementById('select-toggle').textContent = selectMode ? 'Cancel' : 'Select';
  document.getElementById('bulk-bar').style.display = selectMode ? 'flex' : 'none';
  document.querySelectorAll('.bulk-check').forEach(el => { el.style.display = selectMode ? 'inline-block' : 'none'; el.checked = false; });
  updateBulkCount();
}
function toggleBulkItem(id, checked) {
  if (checked) selectedIds.add(id); else selectedIds.delete(id);
  updateBulkCount();
}
function updateBulkCount() {
  document.getElementById('bulk-count').textContent = selectedIds.size + ' selected';
}
function selectAll() {
  document.querySelectorAll('.bulk-check').forEach(el => { el.checked = true; toggleBulkItem(parseInt(el.dataset.id,10), true); });
}
async function bulkAction(action, data) {
  if (!selectedIds.size) return;
  await fetch('/api/bulk/todos', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:Array.from(selectedIds),action:action,data:data||{}})});
  selectedIds.clear(); updateBulkCount(); load();
}
function setHorizon(btn, h) { curHorizon = h; document.querySelectorAll('#horizon-filters button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); load(); }
function setStatus(btn, s) { curStatus = s; document.querySelectorAll('#status-filters button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); load(); }
function setPriority(btn, p) { curPriority = p; document.querySelectorAll('#priority-filters button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); load(); }
function setCategory(btn, c) { curCategory = c; document.querySelectorAll('#category-filters button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); load(); }

async function loadCategories() {
  try {
    var cats = await fetch('/api/todo-categories').then(r=>r.json());
    var container = document.getElementById('category-filters');
    var existing = container.querySelector('button.active');
    var html = '<button class="'+(curCategory===''?'active':'')+'" onclick="setCategory(this,\\'\\')">All Categories</button>';
    cats.forEach(c => { html += '<button class="'+(curCategory===c?'active':'')+'" onclick="setCategory(this,\\''+c+'\\')">'+c.charAt(0).toUpperCase()+c.slice(1)+'</button>'; });
    container.innerHTML = html;
    // Also populate category select in modal
    var sel = document.getElementById('f-category-select');
    var curVal = sel.value;
    sel.innerHTML = '<option value="">None</option>';
    cats.forEach(c => { sel.innerHTML += '<option value="'+c+'">'+c.charAt(0).toUpperCase()+c.slice(1)+'</option>'; });
    sel.innerHTML += '<option value="__custom__">Custom...</option>';
    sel.value = curVal;
  } catch {}
}

async function load() {
  loadCategories();
  var q = [];
  if (curHorizon) q.push('horizon='+curHorizon);
  if (curStatus === 'pending') q.push('completed=false');
  else if (curStatus === 'done') q.push('completed=true');
  if (curPriority) q.push('priority='+curPriority);
  if (curCategory) q.push('category='+curCategory);
  var todos = await fetch('/api/todos'+(q.length?'?'+q.join('&'):'')).then(r=>r.json());
  if (!todos.length) { document.getElementById('todo-list').innerHTML = '<div class="empty-msg">No tasks found</div>'; return; }

  // Fetch subtasks and dependencies for all todos
  var subtaskMap = {}, depMap = {};
  await Promise.all(todos.map(async t => {
    try { subtaskMap[t.id] = await fetch('/api/todos/'+t.id+'/subtasks').then(r=>r.json()); } catch { subtaskMap[t.id] = []; }
    try { depMap[t.id] = await fetch('/api/todos/'+t.id+'/dependencies').then(r=>r.json()); } catch { depMap[t.id] = {blocked_by:[],blocking:[]}; }
  }));

  document.getElementById('todo-list').innerHTML = todos.map((t, idx) => {
    var dueTxt = t.due_date ? 'Due: '+new Date(t.due_date).toLocaleDateString() : '';
    var overdue = t.due_date && !t.completed && new Date(t.due_date) <= new Date() ? ' style="color:var(--red)"' : '';
    var subs = subtaskMap[t.id] || [];
    var subDone = subs.filter(s=>s.completed).length;
    var subHtml = '';
    if (subs.length) {
      subHtml = '<div class="subtask-progress"><div class="subtask-progress-fill" style="width:'+(subDone/subs.length*100)+'%"></div></div>';
      subHtml += '<div class="subtask-list">'+subs.map(s =>
        '<div class="subtask-item"><div class="subtask-check'+(s.completed?' done':'')+'" onclick="event.stopPropagation();toggleSubtask('+s.id+','+!s.completed+')"></div><span class="subtask-text'+(s.completed?' done':'')+'" ondblclick="event.stopPropagation();inlineEditSubtask(this,'+s.id+')">'+esc(s.title)+'</span><button class="subtask-edit-btn" onclick="event.stopPropagation();inlineEditSubtask(this.previousElementSibling,'+s.id+')">&#9998;</button></div>'
      ).join('')+'</div>';
    }
    var deps = depMap[t.id] || {blocked_by:[],blocking:[]};
    var unblockedBy = deps.blocked_by.filter(d=>!d.completed);
    var isBlocked = unblockedBy.length > 0;
    var depBadges = '';
    if (isBlocked) depBadges += '<span class="badge blocked" title="Blocked by: '+unblockedBy.map(d=>esc(d.title)).join(', ')+'">blocked ('+unblockedBy.length+')</span>';
    if (deps.blocking.length) depBadges += '<span class="badge blocking" title="Blocking: '+deps.blocking.map(d=>esc(d.title)).join(', ')+'">blocking ('+deps.blocking.length+')</span>';
    if (t.streak_count > 0) depBadges += '<span class="badge streak" title="Best: '+t.best_streak+'">&#x1F525; '+t.streak_count+' streak</span>';
    if (t.location_name) depBadges += '<span title="'+esc(t.location_name)+'" style="font-size:10px;color:var(--teal);">&#128205; '+esc(t.location_name)+'</span>';
    return '<div class="todo-item'+(isBlocked?' todo-blocked':'')+'" draggable="true" data-id="'+t.id+'" ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="drop(event)" ondragend="dragEnd(event)"><input type="checkbox" class="bulk-check" data-id="'+t.id+'" style="display:'+(selectMode?'inline-block':'none')+';accent-color:var(--warm);margin-right:4px;cursor:pointer;" onchange="toggleBulkItem('+t.id+',this.checked)"><span class="drag-handle">&#9776;</span><div class="todo-check'+(t.completed?' done':'')+'" onclick="toggleTodo('+t.id+','+!t.completed+','+!!t.recurring+')"></div><div class="todo-content"><div class="todo-title'+(t.completed?' done':'')+'">'+esc(t.title)+'</div><div class="todo-meta"><span class="badge '+t.priority+'">'+t.priority+'</span><span class="badge '+t.horizon+'">'+t.horizon+'</span>'+(t.recurring?'<span class="badge recurring">'+t.recurrence_rule+'</span>':'')+depBadges+(t.category?'<span>'+esc(t.category)+'</span>':'')+(dueTxt?'<span'+overdue+'>'+dueTxt+'</span>':'')+(subs.length?'<span>'+subDone+'/'+subs.length+' subtasks</span>':'')+'</div>'+(t.description?'<div style="font-size:12px;color:var(--text-muted);margin-top:4px;font-weight:300">'+esc(t.description)+'</div>':'')+subHtml+'</div><div class="todo-actions"><button onclick="openEdit('+t.id+')">&#9998;</button></div></div>';
  }).join('');
}

// Drag and drop
function dragStart(e) { dragSrcId = e.currentTarget.dataset.id; e.currentTarget.classList.add('dragging'); }
function dragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function dragEnd(e) { document.querySelectorAll('.todo-item').forEach(el => { el.classList.remove('dragging','drag-over'); }); }
async function drop(e) {
  e.preventDefault(); e.currentTarget.classList.remove('drag-over');
  var targetId = e.currentTarget.dataset.id;
  if (dragSrcId === targetId) return;
  var items = document.querySelectorAll('.todo-item[data-id]');
  var order = [];
  items.forEach((el, i) => { order.push({id: parseInt(el.dataset.id), sort_order: i}); });
  // Swap
  var srcIdx = order.findIndex(o => o.id === parseInt(dragSrcId));
  var tgtIdx = order.findIndex(o => o.id === parseInt(targetId));
  if (srcIdx > -1 && tgtIdx > -1) {
    var temp = order[srcIdx]; order[srcIdx] = order[tgtIdx]; order[tgtIdx] = temp;
    order.forEach((o, i) => o.sort_order = i);
    await fetch('/api/todos/reorder', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order})});
    load();
  }
}

// Subtasks
async function toggleSubtask(id, completed) {
  await fetch('/api/subtasks/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed})});
  load();
}

var editSubtasks = [];
async function addSubtask() {
  var input = document.getElementById('new-subtask');
  var title = input.value.trim();
  if (!title) return;
  var todoId = document.getElementById('edit-id').value;
  if (todoId) {
    await fetch('/api/todos/'+todoId+'/subtasks', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})});
    input.value = '';
    loadEditSubtasks(todoId);
  } else {
    editSubtasks.push({title, completed: false});
    input.value = '';
    renderEditSubtasks();
  }
}
function renderEditSubtasks() {
  document.getElementById('subtask-list-edit').innerHTML = editSubtasks.map((s,i) =>
    '<div class="subtask-item"><span class="subtask-text" ondblclick="inlineEditNewSubtask(this,'+i+')">'+esc(s.title)+'</span><button class="subtask-edit-btn" onclick="inlineEditNewSubtask(this.previousElementSibling,'+i+')" title="Edit">&#9998;</button><button onclick="editSubtasks.splice('+i+',1);renderEditSubtasks()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px;padding:8px;-webkit-tap-highlight-color:transparent;touch-action:manipulation;">&#10005;</button></div>'
  ).join('');
}
async function loadEditSubtasks(todoId) {
  var subs = await fetch('/api/todos/'+todoId+'/subtasks').then(r=>r.json());
  document.getElementById('subtask-list-edit').innerHTML = subs.map(s =>
    '<div class="subtask-item"><div class="subtask-check'+(s.completed?' done':'')+'" onclick="toggleSubtask('+s.id+','+!s.completed+');loadEditSubtasks('+todoId+')"></div><span class="subtask-text'+(s.completed?' done':'')+'" ondblclick="inlineEditSubtask(this,'+s.id+','+todoId+')">'+esc(s.title)+'</span><button class="subtask-edit-btn" onclick="inlineEditSubtask(this.previousElementSibling,'+s.id+','+todoId+')" title="Edit">&#9998;</button><button onclick="deleteSubtask('+s.id+','+todoId+')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px;padding:8px;-webkit-tap-highlight-color:transparent;touch-action:manipulation;">&#10005;</button></div>'
  ).join('');
}
async function deleteSubtask(id, todoId) {
  await fetch('/api/subtasks/'+id, {method:'DELETE'});
  loadEditSubtasks(todoId);
}
function inlineEditSubtask(span, id, todoId) {
  if (span.querySelector('input')) return;
  var old = span.textContent;
  var input = document.createElement('input');
  input.type = 'text'; input.value = old;
  input.style.cssText = 'font-size:12px;font-family:inherit;background:var(--surface-2);color:var(--text);border:1px solid var(--warm);border-radius:4px;padding:2px 6px;width:100%;';
  span.textContent = '';
  span.appendChild(input);
  input.focus(); input.select();
  function save() {
    var val = input.value.trim();
    if (val && val !== old) {
      fetch('/api/subtasks/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:val})}).then(function(){ if(todoId) loadEditSubtasks(todoId); else load(); });
    } else {
      span.textContent = old;
    }
  }
  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e) { if(e.key==='Enter'){e.preventDefault();input.blur();} if(e.key==='Escape'){input.value=old;input.blur();} });
}
function inlineEditNewSubtask(span, idx) {
  if (span.querySelector('input')) return;
  var old = span.textContent;
  var input = document.createElement('input');
  input.type = 'text'; input.value = old;
  input.style.cssText = 'font-size:12px;font-family:inherit;background:var(--surface-2);color:var(--text);border:1px solid var(--warm);border-radius:4px;padding:2px 6px;width:100%;';
  span.textContent = '';
  span.appendChild(input);
  input.focus(); input.select();
  function save() {
    var val = input.value.trim();
    if (val) { editSubtasks[idx].title = val; }
    renderEditSubtasks();
  }
  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e) { if(e.key==='Enter'){e.preventDefault();input.blur();} if(e.key==='Escape'){input.value=old;input.blur();} });
}

function openAdd() {
  document.getElementById('modal-title').textContent = 'New Task';
  document.getElementById('edit-id').value = '';
  document.getElementById('f-title').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('f-priority').value = 'medium';
  document.getElementById('f-horizon').value = 'short';
  document.getElementById('f-category-select').value = '';
  document.getElementById('f-category-custom').style.display = 'none';
  document.getElementById('f-category-custom').value = '';
  document.getElementById('f-due').value = '';
  document.getElementById('f-recurring').checked = false;
  document.getElementById('f-recurrence').style.display = 'none';
  document.getElementById('f-recurrence-rule').value = 'weekly';
  document.getElementById('delete-btn').style.display = 'none';
  document.getElementById('subtasks-section').style.display = 'block';
  document.getElementById('deps-section').style.display = 'none';
  document.getElementById('location-section').style.display = 'block';
  document.getElementById('f-location-name').value = '';
  document.getElementById('f-location-lat').value = '';
  document.getElementById('f-location-lng').value = '';
  document.getElementById('f-location-radius').value = 200;
  document.getElementById('location-status').textContent = '';
  editSubtasks = [];
  renderEditSubtasks();
  document.getElementById('modal').classList.add('active');
}

async function openEdit(id) {
  var todos = await fetch('/api/todos').then(r=>r.json());
  var t = todos.find(x=>x.id===id);
  if (!t) return;
  document.getElementById('modal-title').textContent = 'Edit Task';
  document.getElementById('edit-id').value = id;
  document.getElementById('f-title').value = t.title;
  document.getElementById('f-desc').value = t.description||'';
  document.getElementById('f-priority').value = t.priority;
  document.getElementById('f-horizon').value = t.horizon;
  var catSel = document.getElementById('f-category-select');
  var catCustom = document.getElementById('f-category-custom');
  if (t.category && ![...catSel.options].some(o=>o.value===t.category)) {
    catSel.value = '__custom__';
    catCustom.style.display = 'block';
    catCustom.value = t.category;
  } else {
    catSel.value = t.category || '';
    catCustom.style.display = 'none';
    catCustom.value = '';
  }
  document.getElementById('f-due').value = t.due_date?t.due_date.split('T')[0]:'';
  document.getElementById('f-recurring').checked = t.recurring||false;
  document.getElementById('f-recurrence').style.display = t.recurring ? 'block' : 'none';
  document.getElementById('f-recurrence-rule').value = t.recurrence_rule || 'weekly';
  document.getElementById('delete-btn').style.display = 'inline-block';
  document.getElementById('subtasks-section').style.display = 'block';
  document.getElementById('deps-section').style.display = 'block';
  document.getElementById('location-section').style.display = 'block';
  document.getElementById('f-location-name').value = t.location_name || '';
  document.getElementById('f-location-lat').value = t.location_lat || '';
  document.getElementById('f-location-lng').value = t.location_lng || '';
  document.getElementById('f-location-radius').value = t.location_radius || 200;
  document.getElementById('location-status').textContent = t.location_lat ? 'Location: ' + t.location_lat.toFixed(4) + ', ' + t.location_lng.toFixed(4) : '';
  loadEditSubtasks(id);
  loadDeps(id);
  document.getElementById('modal').classList.add('active');
}

function closeModal() { document.getElementById('modal').classList.remove('active'); }

async function saveTodo() {
  var id = document.getElementById('edit-id').value;
  var isRecurring = document.getElementById('f-recurring').checked;
  var data = {
    title: document.getElementById('f-title').value,
    description: document.getElementById('f-desc').value || null,
    priority: document.getElementById('f-priority').value,
    horizon: document.getElementById('f-horizon').value,
    category: (document.getElementById('f-category-select').value === '__custom__' ? document.getElementById('f-category-custom').value : document.getElementById('f-category-select').value) || null,
    due_date: document.getElementById('f-due').value || null,
    recurring: isRecurring,
    recurrence_rule: isRecurring ? document.getElementById('f-recurrence-rule').value : null,
    location_name: document.getElementById('f-location-name').value || null,
    location_lat: parseFloat(document.getElementById('f-location-lat').value) || null,
    location_lng: parseFloat(document.getElementById('f-location-lng').value) || null,
    location_radius: parseInt(document.getElementById('f-location-radius').value) || 200,
  };
  if (!data.title) return alert('Title is required');
  var result;
  if (id) {
    result = await fetch('/api/todos/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(r=>r.json());
  } else {
    result = await fetch('/api/todos', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(r=>r.json());
    // Create subtasks for new todo
    if (result.id && editSubtasks.length) {
      for (var s of editSubtasks) {
        await fetch('/api/todos/'+result.id+'/subtasks', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:s.title})});
      }
    }
  }
  closeModal(); load();
}

async function toggleTodo(id, completed, isRecurring) {
  if (completed && isRecurring) {
    await fetch('/api/todos/'+id+'/complete-recurring', {method:'POST'});
  } else {
    await fetch('/api/todos/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed})});
  }
  load();
}

async function deleteTodo() {
  var id = document.getElementById('edit-id').value;
  await fetch('/api/todos/'+id, {method:'DELETE'});
  closeModal(); load();
  showUndo('Task moved to trash','todo',id);
}

// Location
function getLocation() {
  if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
  document.getElementById('location-status').textContent = 'Getting location...';
  navigator.geolocation.getCurrentPosition(function(pos) {
    document.getElementById('f-location-lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('f-location-lng').value = pos.coords.longitude.toFixed(6);
    document.getElementById('location-status').textContent = 'Location set: ' + pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4);
  }, function(err) {
    document.getElementById('location-status').textContent = 'Error: ' + err.message;
  }, {enableHighAccuracy: true});
}

// Check location reminders periodically
function checkLocationReminders() {
  if (!navigator.geolocation || !('Notification' in window) || Notification.permission !== 'granted') return;
  navigator.geolocation.getCurrentPosition(async function(pos) {
    try {
      var todos = await fetch('/api/todos?completed=false').then(r=>r.json());
      todos.filter(t => t.location_lat && t.location_lng).forEach(t => {
        var dist = haversine(pos.coords.latitude, pos.coords.longitude, t.location_lat, t.location_lng);
        if (dist <= (t.location_radius || 200)) {
          new Notification('Per-sistant Reminder', { body: t.title + (t.location_name ? ' (near ' + t.location_name + ')' : ''), icon: '/icon-192.svg' });
        }
      });
    } catch {}
  }, function(){}, {enableHighAccuracy: false, timeout: 5000});
}
function haversine(lat1, lon1, lat2, lon2) {
  var R = 6371000; var p = Math.PI / 180;
  var a = 0.5 - Math.cos((lat2-lat1)*p)/2 + Math.cos(lat1*p)*Math.cos(lat2*p)*(1-Math.cos((lon2-lon1)*p))/2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
if (typeof setInterval !== 'undefined') setInterval(checkLocationReminders, 300000); // every 5 min

// Dependencies
async function loadDeps(todoId) {
  var deps = await fetch('/api/todos/'+todoId+'/dependencies').then(r=>r.json());
  var html = '';
  if (deps.blocked_by.length) {
    html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Blocked by:</div>';
    deps.blocked_by.forEach(d => {
      html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;"><span class="badge blocked">blocked by</span><span'+(d.completed?' style="text-decoration:line-through;opacity:0.5"':'')+'>'+esc(d.title)+'</span><button onclick="removeDep('+d.dep_id+','+todoId+')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px;padding:4px;">&times;</button></div>';
    });
  }
  if (deps.blocking.length) {
    html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;margin-top:6px;">Blocking:</div>';
    deps.blocking.forEach(d => {
      html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;"><span class="badge blocking">blocking</span><span>'+esc(d.title)+'</span></div>';
    });
  }
  if (!deps.blocked_by.length && !deps.blocking.length) html = '<div style="font-size:11px;color:var(--text-muted);">No dependencies</div>';
  document.getElementById('deps-list').innerHTML = html;
  // Populate select with other todos
  var todos = await fetch('/api/todos?completed=false').then(r=>r.json());
  var existing = new Set(deps.blocked_by.map(d=>d.depends_on_id));
  var sel = document.getElementById('dep-select');
  sel.innerHTML = '<option value="">Select a task this depends on...</option>';
  todos.filter(t => t.id !== parseInt(todoId) && !existing.has(t.id)).forEach(t => {
    sel.innerHTML += '<option value="'+t.id+'">'+esc(t.title)+'</option>';
  });
}
async function addDep() {
  var todoId = document.getElementById('edit-id').value;
  var depId = document.getElementById('dep-select').value;
  if (!depId || !todoId) return;
  var r = await fetch('/api/todos/'+todoId+'/dependencies', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({depends_on_id:parseInt(depId)})}).then(r=>r.json());
  if (r.error) { alert(r.error); return; }
  loadDeps(todoId);
}
async function removeDep(depId, todoId) {
  await fetch('/api/dependencies/'+depId, {method:'DELETE'});
  loadDeps(todoId);
}

// Quick Add (natural language)
function openQuickTodo() {
  document.getElementById('qt-input').value = '';
  document.getElementById('qt-preview').style.display = 'none';
  document.getElementById('qt-confirm').style.display = 'none';
  document.getElementById('quick-todo-modal').classList.add('active');
  document.getElementById('qt-input').focus();
}
function closeQuickTodo() { document.getElementById('quick-todo-modal').classList.remove('active'); }

var parsedTodo = null;
function parseQuickTodo() {
  var input = document.getElementById('qt-input').value.trim();
  if (!input) return;
  var days = {sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
  var dateMatch = input.match(/\b(\d{4}-\d{2}-\d{2})\b/) || input.match(/\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(?:,?\s*\d{4})?)\b/i);
  var tomorrowMatch = input.match(/\btomorrow\b/i);
  var dayMatch = input.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  var dueDate = null;
  if (dateMatch) { dueDate = new Date(dateMatch[1]); }
  else if (tomorrowMatch) { dueDate = new Date(); dueDate.setDate(dueDate.getDate()+1); }
  else if (dayMatch) {
    dueDate = new Date();
    var target = days[dayMatch[1].toLowerCase()];
    var diff = (target - dueDate.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    dueDate.setDate(dueDate.getDate() + diff);
  }
  // Extract priority
  var priority = 'medium';
  if (/\burgent\b/i.test(input)) priority = 'urgent';
  else if (/\bhigh\b|\bimportant\b/i.test(input)) priority = 'high';
  else if (/\blow\b/i.test(input)) priority = 'low';
  // Clean title
  var title = input.replace(/\b(tomorrow|today|urgent|high|low|important)\b/gi, '').replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '').replace(/\b(by|on|at|next|this)\b/gi, '').replace(/\s+/g,' ').trim();
  parsedTodo = { title: title, priority: priority, due_date: dueDate ? dueDate.toISOString().split('T')[0] : null, horizon: 'short' };
  document.getElementById('qt-preview-content').innerHTML =
    '<div style="font-size:13px;"><strong>Task:</strong> '+esc(parsedTodo.title)+'<br><strong>Priority:</strong> '+parsedTodo.priority+'<br><strong>Due:</strong> '+(parsedTodo.due_date||'None')+'</div>';
  document.getElementById('qt-preview').style.display = 'block';
  document.getElementById('qt-confirm').style.display = 'inline-block';
}
async function confirmQuickTodo() {
  if (!parsedTodo || !parsedTodo.title) return;
  await fetch('/api/todos', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsedTodo)});
  closeQuickTodo(); load();
}

// AI Task Breakdown
async function aiBreakdown() {
  var title = document.getElementById('f-title').value;
  if (!title) return alert('Enter a task title first');
  var btn = document.getElementById('ai-breakdown-btn');
  btn.textContent = 'Thinking...'; btn.disabled = true;
  try {
    var r = await fetch('/api/ai/task-breakdown', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title, description: document.getElementById('f-desc').value})}).then(r=>r.json());
    if (r.error) { alert(r.error); return; }
    var todoId = document.getElementById('edit-id').value;
    if (todoId) {
      for (var s of r.subtasks) {
        await fetch('/api/todos/'+todoId+'/subtasks', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:s})});
      }
      loadEditSubtasks(todoId);
    } else {
      r.subtasks.forEach(s => editSubtasks.push({title:s, completed:false}));
      renderEditSubtasks();
    }
  } catch (err) { alert('AI breakdown failed: '+err.message); }
  finally { btn.textContent = 'AI Breakdown'; btn.disabled = false; }
}

// AI-enhanced Quick Add
var parsedTodoAI = null;
async function parseQuickTodoAI() {
  var input = document.getElementById('qt-input').value.trim();
  if (!input) return;
  var btn = document.querySelector('#quick-todo-modal .primary');
  btn.textContent = 'Parsing...'; btn.disabled = true;
  try {
    var r = await fetch('/api/ai/parse-todo', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input})}).then(r=>r.json());
    if (r.error) { parseQuickTodo(); return; } // Fallback to regex parsing
    parsedTodo = r;
    document.getElementById('qt-preview-content').innerHTML =
      '<div style="font-size:13px;"><strong>Task:</strong> '+esc(r.title)+'<br><strong>Priority:</strong> '+r.priority+'<br><strong>Horizon:</strong> '+r.horizon+'<br><strong>Category:</strong> '+(r.category||'None')+'<br><strong>Due:</strong> '+(r.due_date||'None')+'</div>';
    document.getElementById('qt-preview').style.display = 'block';
    document.getElementById('qt-confirm').style.display = 'inline-block';
  } catch { parseQuickTodo(); } // Fallback to regex
  finally { btn.textContent = 'Parse'; btn.disabled = false; }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openAdd(); }
  else if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); openQuickTodo(); }
});


load();
</script>
</body></html>`);
});


// ============================================================================
// Page — Emails
// ============================================================================
app.get("/emails", (req, res) => {
  res.send(`${pageHead("Emails")}
<body>
${themeScript()}
<div class="container">
  ${navBar("/emails")}
  <h1>Emails</h1>
  <p class="subtitle">Draft, schedule, and send emails</p>

  <div class="actions">
    <button class="primary" onclick="openCompose()">+ Compose</button>
    <button onclick="openQuick()">Quick Send</button>
    <button onclick="openTemplates()">Templates</button>
    <button id="email-select-toggle" onclick="toggleEmailSelect()">Select</button>
  </div>
  <div id="email-bulk-bar" style="display:none;padding:10px 16px;margin-bottom:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);align-items:center;gap:8px;font-size:13px;">
    <span id="email-bulk-count">0 selected</span>
    <button onclick="emailBulkAction('delete')" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;">Delete</button>
    <button onclick="emailSelectAll()" style="margin-left:auto;background:none;border:1px solid var(--border);color:var(--text-muted);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit;">Select All</button>
  </div>

  <div class="filters" id="email-filters">
    <button class="active" onclick="setFilter(this,'')">All</button>
    <button onclick="setFilter(this,'draft')">Drafts</button>
    <button onclick="setFilter(this,'scheduled')">Scheduled</button>
    <button onclick="setFilter(this,'sent')">Sent</button>
    <button onclick="setFilter(this,'failed')">Failed</button>
  </div>

  <div class="section">
    <div id="email-list"></div>
  </div>
</div>

<!-- Compose Modal -->
<div class="modal-overlay" id="compose-modal">
  <div class="modal">
    <h2 id="compose-title">Compose Email</h2>
    <input type="hidden" id="e-id">
    <label>Recipient Name</label>
    <input type="text" id="e-name" placeholder="Name (for contact lookup)">
    <label>Recipient Email</label>
    <input type="email" id="e-email" placeholder="email@example.com">
    <label>Subject</label>
    <input type="text" id="e-subject" placeholder="Subject line">
    <label>Body <button onclick="aiDraft()" style="float:right;padding:4px 10px;font-size:10px;font-weight:500;border:1px solid var(--teal);border-radius:6px;cursor:pointer;background:transparent;color:var(--teal);font-family:inherit;text-transform:uppercase;letter-spacing:0.5px;">AI Draft</button></label>
    <textarea id="e-body" style="min-height:160px" placeholder="Write your email..."></textarea>
    <div id="tone-buttons" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
      <span style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;padding:5px 0;">Adjust tone:</span>
      <button onclick="adjustTone('more formal')" class="tone-btn" style="padding:4px 10px;font-size:10px;font-weight:500;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:transparent;color:var(--text-muted);font-family:inherit;">Formal</button>
      <button onclick="adjustTone('more casual')" class="tone-btn" style="padding:4px 10px;font-size:10px;font-weight:500;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:transparent;color:var(--text-muted);font-family:inherit;">Casual</button>
      <button onclick="adjustTone('shorter')" class="tone-btn" style="padding:4px 10px;font-size:10px;font-weight:500;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:transparent;color:var(--text-muted);font-family:inherit;">Shorter</button>
      <button onclick="adjustTone('friendlier')" class="tone-btn" style="padding:4px 10px;font-size:10px;font-weight:500;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:transparent;color:var(--text-muted);font-family:inherit;">Friendlier</button>
      <button onclick="adjustTone('more direct')" class="tone-btn" style="padding:4px 10px;font-size:10px;font-weight:500;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:transparent;color:var(--text-muted);font-family:inherit;">Direct</button>
    </div>
    <label>Schedule Send (optional)</label>
    <input type="datetime-local" id="e-schedule">
    <div class="modal-actions">
      <button onclick="closeCompose()">Cancel</button>
      <button class="primary" onclick="saveEmail()">Save Draft</button>
      <button class="primary" onclick="saveAndSchedule()" style="border-color:var(--yellow);color:var(--yellow)">Schedule</button>
      <button id="send-now-btn" style="border-color:var(--green);color:var(--green)" onclick="sendNow()">Send Now</button>
      <button class="danger" id="e-delete-btn" style="display:none" onclick="deleteEmail()">Delete</button>
    </div>
  </div>
</div>

<!-- Quick Send Modal -->
<div class="modal-overlay" id="quick-modal">
  <div class="modal">
    <h2>Quick Send</h2>
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px;">
      Example: "Send an email to Mom Tuesday morning at 9AM about dinner plans"
    </p>
    <label>What would you like to send?</label>
    <textarea id="q-input" style="min-height:80px" placeholder="Send an email to [name] [when] about [topic]..."></textarea>
    <div id="q-preview" style="display:none;margin-top:16px;">
      <div class="section" style="margin-bottom:0">
        <h2>Preview</h2>
        <div id="q-preview-content"></div>
      </div>
    </div>
    <div class="modal-actions">
      <button onclick="closeQuick()">Cancel</button>
      <button class="primary" onclick="parseQuick()">Parse & Preview</button>
      <button class="primary" id="q-confirm" style="display:none" onclick="confirmQuick()">Confirm & Schedule</button>
    </div>
  </div>
</div>

<script>
var curFilter = '';
var emailSelectMode = false, emailSelectedIds = new Set();
function setFilter(btn, f) { curFilter = f; document.querySelectorAll('#email-filters button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); load(); }

function toggleEmailSelect() {
  emailSelectMode = !emailSelectMode; emailSelectedIds.clear();
  document.getElementById('email-select-toggle').textContent = emailSelectMode ? 'Cancel' : 'Select';
  document.getElementById('email-bulk-bar').style.display = emailSelectMode ? 'flex' : 'none';
  document.querySelectorAll('.email-bulk-check').forEach(el => { el.style.display = emailSelectMode ? 'inline-block' : 'none'; el.checked = false; });
  updateEmailBulkCount();
}
function toggleEmailBulkItem(id, checked) { if (checked) emailSelectedIds.add(id); else emailSelectedIds.delete(id); updateEmailBulkCount(); }
function updateEmailBulkCount() { document.getElementById('email-bulk-count').textContent = emailSelectedIds.size + ' selected'; }
function emailSelectAll() { document.querySelectorAll('.email-bulk-check').forEach(el => { el.checked = true; toggleEmailBulkItem(parseInt(el.dataset.id,10), true); }); }
async function emailBulkAction(action) {
  if (!emailSelectedIds.size) return;
  await fetch('/api/bulk/emails', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:Array.from(emailSelectedIds),action:action})});
  emailSelectedIds.clear(); updateEmailBulkCount(); load();
}

async function load() {
  var q = curFilter ? '?status='+curFilter : '';
  var emails = await fetch('/api/emails'+q).then(r=>r.json());
  if (!emails.length) { document.getElementById('email-list').innerHTML = '<div class="empty-msg">No emails found</div>'; return; }
  document.getElementById('email-list').innerHTML = '<table><thead><tr><th style="width:30px;"></th><th>Status</th><th>To</th><th>Subject</th><th>Scheduled</th><th>Actions</th></tr></thead><tbody>' +
    emails.map(e => '<tr><td><input type="checkbox" class="email-bulk-check" data-id="'+e.id+'" style="display:'+(emailSelectMode?'inline-block':'none')+';accent-color:var(--warm);cursor:pointer;" onchange="toggleEmailBulkItem('+e.id+',this.checked)"></td><td><span class="badge '+e.status+'">'+e.status+'</span></td><td>'+esc(e.recipient_name||e.recipient_email)+'</td><td>'+esc(e.subject)+'</td><td>'+(e.scheduled_at?new Date(e.scheduled_at).toLocaleString():'—')+'</td><td><div class="todo-actions"><button onclick="openEditEmail('+e.id+')">&#9998;</button><button class="delete" onclick="deleteEmailDirect('+e.id+')">&#10005;</button></div></td></tr>'
    ).join('') + '</tbody></table>';
}

function openCompose() {
  document.getElementById('compose-title').textContent = 'Compose Email';
  document.getElementById('e-id').value = '';
  document.getElementById('e-name').value = '';
  document.getElementById('e-email').value = '';
  document.getElementById('e-subject').value = '';
  document.getElementById('e-body').value = '';
  document.getElementById('e-schedule').value = '';
  document.getElementById('e-delete-btn').style.display = 'none';
  document.getElementById('compose-modal').classList.add('active');
}

async function openEditEmail(id) {
  var emails = await fetch('/api/emails').then(r=>r.json());
  var e = emails.find(x=>x.id===id);
  if (!e) return;
  document.getElementById('compose-title').textContent = 'Edit Email';
  document.getElementById('e-id').value = id;
  document.getElementById('e-name').value = e.recipient_name||'';
  document.getElementById('e-email').value = e.recipient_email;
  document.getElementById('e-subject').value = e.subject;
  document.getElementById('e-body').value = e.body;
  document.getElementById('e-schedule').value = e.scheduled_at?e.scheduled_at.slice(0,16):'';
  document.getElementById('e-delete-btn').style.display = 'inline-block';
  document.getElementById('compose-modal').classList.add('active');
}

function closeCompose() { document.getElementById('compose-modal').classList.remove('active'); }

// Lookup contact name to auto-fill email
document.getElementById('e-name').addEventListener('blur', async function() {
  var name = this.value.trim();
  if (!name || document.getElementById('e-email').value) return;
  try {
    var c = await fetch('/api/contacts/lookup/'+encodeURIComponent(name)).then(r=>r.ok?r.json():null);
    if (c) document.getElementById('e-email').value = c.email;
  } catch {}
});

async function saveEmail() {
  var data = getEmailData();
  if (!data) return;
  var id = document.getElementById('e-id').value;
  if (id) await fetch('/api/emails/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  else await fetch('/api/emails', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  closeCompose(); load();
}

async function saveAndSchedule() {
  var data = getEmailData();
  if (!data) return;
  if (!data.scheduled_at) return alert('Set a schedule time first');
  data.status = 'scheduled';
  var id = document.getElementById('e-id').value;
  if (id) await fetch('/api/emails/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  else await fetch('/api/emails', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,scheduled_at:data.scheduled_at})});
  closeCompose(); load();
}

async function sendNow() {
  var id = document.getElementById('e-id').value;
  if (!id) { await saveEmail(); var emails = await fetch('/api/emails').then(r=>r.json()); id = emails[0]?.id; }
  if (!id) return;
  var r = await fetch('/api/emails/'+id+'/send', {method:'POST'}).then(r=>r.json());
  if (r.ok) { alert('Email sent!'); closeCompose(); load(); }
  else alert('Failed: '+(r.error||'Unknown error'));
}

async function deleteEmail() {
  var id = document.getElementById('e-id').value;
  await fetch('/api/emails/'+id, {method:'DELETE'});
  closeCompose(); load();
  showUndo('Email moved to trash','email',id);
}

async function deleteEmailDirect(id) {
  await fetch('/api/emails/'+id, {method:'DELETE'});
  load();
  showUndo('Email moved to trash','email',id);
}

function getEmailData() {
  var data = {
    recipient_name: document.getElementById('e-name').value || null,
    recipient_email: document.getElementById('e-email').value,
    subject: document.getElementById('e-subject').value,
    body: document.getElementById('e-body').value,
  };
  var sched = document.getElementById('e-schedule').value;
  if (sched) data.scheduled_at = new Date(sched).toISOString();
  if (!data.recipient_email || !data.subject || !data.body) { alert('Email, subject, and body are required'); return null; }
  return data;
}

// AI Draft
async function aiDraft() {
  var subject = document.getElementById('e-subject').value;
  var name = document.getElementById('e-name').value;
  var prompt = subject || document.getElementById('e-body').value;
  if (!prompt) { prompt = window.prompt('Describe the email you want to write:'); if (!prompt) return; }
  var btn = event.target; btn.textContent = 'Drafting...'; btn.disabled = true;
  try {
    var r = await fetch('/api/ai/draft-email', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt, recipient_name: name})}).then(r=>r.json());
    if (r.error) { alert(r.error); return; }
    if (r.subject) document.getElementById('e-subject').value = r.subject;
    if (r.body) document.getElementById('e-body').value = r.body;
  } catch (err) { alert('AI draft failed: '+err.message); }
  finally { btn.textContent = 'AI Draft'; btn.disabled = false; }
}

// Tone adjustment
async function adjustTone(tone) {
  var body = document.getElementById('e-body').value;
  if (!body) return alert('Write or draft an email first');
  var btns = document.querySelectorAll('.tone-btn');
  btns.forEach(b => { b.disabled = true; });
  try {
    var r = await fetch('/api/ai/adjust-tone', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body, tone})}).then(r=>r.json());
    if (r.error) { alert(r.error); return; }
    if (r.body) document.getElementById('e-body').value = r.body;
  } catch (err) { alert('Tone adjustment failed: '+err.message); }
  finally { btns.forEach(b => { b.disabled = false; }); }
}

// Templates
async function openTemplates() {
  var templates = await fetch('/api/email-templates').then(r=>r.json());
  var html = '<h2>Email Templates</h2>';
  if (templates.length) {
    html += templates.map(t => '<div class="todo-item" style="cursor:pointer" onclick="useTemplate('+t.id+')"><div class="todo-content"><div class="todo-title">'+esc(t.name)+'</div><div class="todo-meta"><span>'+esc(t.subject)+'</span></div></div><div class="todo-actions"><button onclick="event.stopPropagation();deleteTemplate('+t.id+')">&#10005;</button></div></div>').join('');
  } else { html += '<div class="empty-msg">No templates yet</div>'; }
  html += '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);"><h2 style="font-size:10px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;">Save Current as Template</h2><input type="text" id="tpl-name" placeholder="Template name" style="width:100%;padding:8px 12px;font-size:13px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);margin-bottom:8px;"><button onclick="saveAsTemplate()" class="primary" style="padding:8px 16px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;">Save Template</button></div>';
  var overlay = document.createElement('div'); overlay.className = 'modal-overlay active'; overlay.id = 'tpl-modal';
  overlay.innerHTML = '<div class="modal">'+html+'<div class="modal-actions"><button onclick="document.getElementById(\\\'tpl-modal\\\').remove()">Close</button></div></div>';
  document.body.appendChild(overlay);
}
async function useTemplate(id) {
  var templates = await fetch('/api/email-templates').then(r=>r.json());
  var t = templates.find(x=>x.id===id);
  if (!t) return;
  document.getElementById('e-subject').value = t.subject;
  document.getElementById('e-body').value = t.body;
  var tplModal = document.getElementById('tpl-modal');
  if (tplModal) tplModal.remove();
  openCompose();
}
async function saveAsTemplate() {
  var name = document.getElementById('tpl-name').value;
  var subject = document.getElementById('e-subject').value || 'Untitled';
  var body = document.getElementById('e-body').value || '';
  if (!name) return alert('Template name required');
  await fetch('/api/email-templates', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,subject,body})});
  var tplModal = document.getElementById('tpl-modal');
  if (tplModal) tplModal.remove();
  openTemplates();
}
async function deleteTemplate(id) {
  if (!confirm('Delete template?')) return;
  await fetch('/api/email-templates/'+id, {method:'DELETE'});
  var tplModal = document.getElementById('tpl-modal');
  if (tplModal) tplModal.remove();
  openTemplates();
}

// Quick send — natural language parsing
function openQuick() {
  document.getElementById('q-input').value = '';
  document.getElementById('q-preview').style.display = 'none';
  document.getElementById('q-confirm').style.display = 'none';
  document.getElementById('quick-modal').classList.add('active');
}
function closeQuick() { document.getElementById('quick-modal').classList.remove('active'); }

var parsedQuick = null;
async function parseQuick() {
  var input = document.getElementById('q-input').value.trim();
  if (!input) return;
  // Simple NLP: extract name, time, and topic
  var nameMatch = input.match(/(?:to|email)\s+(\w+)/i);
  var name = nameMatch ? nameMatch[1] : null;
  var email = null;
  if (name) {
    try {
      var c = await fetch('/api/contacts/lookup/'+encodeURIComponent(name)).then(r=>r.ok?r.json():null);
      if (c) { email = c.email; name = c.name; }
    } catch {}
  }

  // Parse time expressions
  var schedDate = parseTimeExpr(input);

  // Extract topic
  var topicMatch = input.match(/(?:about|regarding|for|re:?)\s+(.+?)(?:\s+(?:on|at|this|next|tomorrow|today)|$)/i);
  var topic = topicMatch ? topicMatch[1] : 'Follow up';

  parsedQuick = {
    recipient_name: name,
    recipient_email: email || (name ? name+'@email.com' : ''),
    subject: topic.charAt(0).toUpperCase() + topic.slice(1),
    body: 'Hi' + (name ? ' '+name : '') + ',\\n\\nI wanted to reach out regarding ' + topic.toLowerCase() + '.\\n\\nBest regards',
    scheduled_at: schedDate ? schedDate.toISOString() : null,
  };

  document.getElementById('q-preview-content').innerHTML =
    '<div style="font-size:13px;"><strong>To:</strong> '+(name||'?')+' &lt;'+(email||'enter email')+'&gt;<br>'+
    '<strong>Subject:</strong> '+esc(parsedQuick.subject)+'<br>'+
    '<strong>Scheduled:</strong> '+(schedDate?schedDate.toLocaleString():'Not scheduled')+'<br><br>'+
    '<div style="white-space:pre-wrap;color:var(--text-muted)">'+esc(parsedQuick.body)+'</div></div>';
  document.getElementById('q-preview').style.display = 'block';
  document.getElementById('q-confirm').style.display = 'inline-block';
}

function parseTimeExpr(text) {
  var now = new Date();
  var days = {sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,
              sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6};
  var dayMatch = text.match(/(?:on\s+|this\s+|next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)/i);
  var timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  var morningMatch = text.match(/\bmorning\b/i);
  var afternoonMatch = text.match(/\bafternoon\b/i);
  var eveningMatch = text.match(/\bevening\b/i);
  var tomorrowMatch = text.match(/\btomorrow\b/i);

  var target = new Date(now);
  if (tomorrowMatch) { target.setDate(target.getDate()+1); }
  else if (dayMatch) {
    var targetDay = days[dayMatch[1].toLowerCase()];
    var diff = (targetDay - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    target.setDate(target.getDate() + diff);
  }

  if (timeMatch) {
    var h = parseInt(timeMatch[1]);
    var m = parseInt(timeMatch[2]||'0');
    if (timeMatch[3].toLowerCase() === 'pm' && h < 12) h += 12;
    if (timeMatch[3].toLowerCase() === 'am' && h === 12) h = 0;
    target.setHours(h, m, 0, 0);
  } else if (morningMatch) { target.setHours(9,0,0,0); }
  else if (afternoonMatch) { target.setHours(14,0,0,0); }
  else if (eveningMatch) { target.setHours(18,0,0,0); }
  else { target.setHours(9,0,0,0); }

  return target > now ? target : null;
}

async function confirmQuick() {
  if (!parsedQuick) return;
  if (!parsedQuick.recipient_email || parsedQuick.recipient_email.includes('@email.com')) {
    var em = prompt('Enter recipient email:');
    if (!em) return;
    parsedQuick.recipient_email = em;
  }
  var status = parsedQuick.scheduled_at ? 'scheduled' : 'draft';
  await fetch('/api/emails', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...parsedQuick, status})});
  closeQuick(); load();
}


load();
</script>
</body></html>`);
});


// ============================================================================
// Page — Notes
// ============================================================================
app.get("/notes", (req, res) => {
  res.send(`${pageHead("Notes")}
<body>
${themeScript()}
<div class="container">
  ${navBar("/notes")}
  <h1>Notes</h1>
  <p class="subtitle">Quick notes and reminders</p>

  <div class="actions">
    <button class="primary" onclick="openNote()">+ New Note</button>
    <button id="note-select-toggle" onclick="toggleNoteSelect()">Select</button>
  </div>
  <div id="note-bulk-bar" style="display:none;padding:10px 16px;margin-bottom:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);align-items:center;gap:8px;font-size:13px;">
    <span id="note-bulk-count">0 selected</span>
    <button onclick="noteBulkAction('delete')" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;">Delete</button>
    <button onclick="noteSelectAll()" style="margin-left:auto;background:none;border:1px solid var(--border);color:var(--text-muted);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit;">Select All</button>
  </div>

  <div class="notes-grid" id="notes-grid"></div>
</div>

<!-- Note Modal -->
<div class="modal-overlay" id="note-modal">
  <div class="modal">
    <h2 id="note-modal-title">New Note</h2>
    <input type="hidden" id="n-id">
    <label>Title</label>
    <input type="text" id="n-title" placeholder="Optional title">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
      <label style="margin:0;">Content</label>
      <label style="display:inline;cursor:pointer;font-size:11px;margin:0;">
        <input type="checkbox" id="n-markdown" style="width:auto;margin-right:4px;" onchange="toggleMdPreview()"> Markdown
      </label>
      <button id="n-preview-btn" onclick="toggleMdPreview()" style="display:none;padding:2px 10px;font-size:10px;font-weight:500;border:1px solid var(--teal);border-radius:6px;cursor:pointer;background:transparent;color:var(--teal);font-family:inherit;">Preview</button>
    </div>
    <div style="position:relative;">
      <textarea id="n-content" style="min-height:200px" placeholder="Write your note... (supports **bold**, *italic*, - lists, > quotes, [links](url))"></textarea>
      <button onclick="startVoiceInput('n-content')" title="Voice input" style="position:absolute;top:10px;right:10px;padding:6px 10px;font-size:14px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:var(--surface);color:var(--warm);z-index:1;">&#127908;</button>
    </div>
    <div id="n-md-preview" style="display:none;min-height:100px;max-height:300px;overflow-y:auto;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);font-size:13px;line-height:1.6;margin-bottom:12px;"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div><label>Color</label>
        <select id="n-color"><option value="default">Default</option><option value="warm">Warm</option><option value="teal">Teal</option><option value="green">Green</option><option value="blue">Blue</option></select>
      </div>
      <div><label>Reminder</label>
        <input type="datetime-local" id="n-reminder"></div>
    </div>
    <div style="margin-top:12px;">
      <label style="display:inline;cursor:pointer">
        <input type="checkbox" id="n-pinned" style="width:auto;margin-right:6px;"> Pin to top
      </label>
    </div>
    <div style="margin-top:12px;">
      <label>Tags <button onclick="suggestTags()" id="suggest-tags-btn" style="float:right;padding:4px 10px;font-size:10px;font-weight:500;border:1px solid var(--teal);border-radius:6px;cursor:pointer;background:transparent;color:var(--teal);font-family:inherit;text-transform:uppercase;letter-spacing:0.5px;">AI Suggest</button></label>
      <div id="n-tags-list" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;"></div>
      <div style="display:flex;gap:8px;">
        <input type="text" id="n-tag-input" placeholder="Add tag..." style="flex:1" onkeydown="if(event.key==='Enter'){event.preventDefault();addTag();}">
        <button onclick="addTag()" style="padding:8px 12px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:6px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;">Add</button>
      </div>
    </div>
    <div class="modal-actions">
      <button onclick="closeNote()">Cancel</button>
      <button class="primary" onclick="saveNote()">Save</button>
      <button class="danger" id="n-delete-btn" style="display:none" onclick="deleteNote()">Delete</button>
    </div>
  </div>
</div>

<script>
var colorMap = {warm:'var(--warm)',teal:'var(--teal)',green:'var(--green)',blue:'var(--blue)',default:'var(--border)'};
var currentTags = [];
var noteSelectMode = false, noteSelectedIds = new Set();
function toggleNoteSelect() {
  noteSelectMode = !noteSelectMode; noteSelectedIds.clear();
  document.getElementById('note-select-toggle').textContent = noteSelectMode ? 'Cancel' : 'Select';
  document.getElementById('note-bulk-bar').style.display = noteSelectMode ? 'flex' : 'none';
  document.querySelectorAll('.note-bulk-check').forEach(el => { el.style.display = noteSelectMode ? 'block' : 'none'; el.checked = false; });
  updateNoteBulkCount();
}
function toggleNoteBulkItem(id, checked, ev) { ev.stopPropagation(); if (checked) noteSelectedIds.add(id); else noteSelectedIds.delete(id); updateNoteBulkCount(); }
function updateNoteBulkCount() { document.getElementById('note-bulk-count').textContent = noteSelectedIds.size + ' selected'; }
function noteSelectAll() { document.querySelectorAll('.note-bulk-check').forEach(el => { el.checked = true; toggleNoteBulkItem(parseInt(el.dataset.id,10), true, {stopPropagation:function(){}}); }); }
async function noteBulkAction(action) {
  if (!noteSelectedIds.size) return;
  await fetch('/api/bulk/notes', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:Array.from(noteSelectedIds),action:action})});
  noteSelectedIds.clear(); updateNoteBulkCount(); load();
}

function renderTags() {
  document.getElementById('n-tags-list').innerHTML = currentTags.map((t,i) =>
    '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:500;background:var(--surface-2);border:1px solid var(--border);color:var(--text-muted);">'+esc(t)+'<span onclick="removeTag('+i+')" style="cursor:pointer;color:var(--red);font-size:12px;">&times;</span></span>'
  ).join('');
}
function addTag() {
  var input = document.getElementById('n-tag-input');
  var tag = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (tag && !currentTags.includes(tag)) { currentTags.push(tag); renderTags(); }
  input.value = '';
}
function removeTag(i) { currentTags.splice(i, 1); renderTags(); }

async function suggestTags() {
  var content = document.getElementById('n-content').value;
  var title = document.getElementById('n-title').value;
  if (!content) return alert('Write some content first');
  var btn = document.getElementById('suggest-tags-btn');
  btn.textContent = 'Thinking...'; btn.disabled = true;
  try {
    var r = await fetch('/api/ai/suggest-tags', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title, content})}).then(r=>r.json());
    if (r.error) { alert(r.error); return; }
    r.tags.forEach(t => { if (!currentTags.includes(t)) currentTags.push(t); });
    renderTags();
  } catch (err) { alert('Failed: '+err.message); }
  finally { btn.textContent = 'AI Suggest'; btn.disabled = false; }
}

async function load() {
  var notes = await fetch('/api/notes').then(r=>r.json());
  if (!notes.length) { document.getElementById('notes-grid').innerHTML = '<div class="empty-msg" style="grid-column:1/-1">No notes yet. Create your first note!</div>'; return; }
  document.getElementById('notes-grid').innerHTML = notes.map(n => {
    var borderStyle = n.pinned ? 'border-color:'+(colorMap[n.color]||'var(--warm)') : (n.color!=='default'?'border-color:'+colorMap[n.color]:'');
    var tagsHtml = n.tags && n.tags.length ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px;">'+n.tags.map(t=>'<span style="padding:2px 8px;border-radius:12px;font-size:9px;background:var(--surface-2);border:1px solid var(--border);color:var(--text-muted);">'+esc(t)+'</span>').join('')+'</div>' : '';
    return '<div class="note-card'+(n.pinned?' pinned':'')+'" style="position:relative;'+borderStyle+'" onclick="openEditNote('+n.id+')">'+
      '<input type="checkbox" class="note-bulk-check" data-id="'+n.id+'" style="display:'+(noteSelectMode?'block':'none')+';position:absolute;top:10px;right:10px;accent-color:var(--warm);cursor:pointer;z-index:2;" onclick="event.stopPropagation()" onchange="toggleNoteBulkItem('+n.id+',this.checked,event)">'+
      (n.pinned?'<div style="font-size:10px;color:var(--warm);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">&#128204; Pinned</div>':'')+
      (n.title?'<div class="note-title">'+esc(n.title)+(n.format==='markdown'?'<span class="md-badge">MD</span>':'')+'</div>':(!n.title && n.format==='markdown'?'<div style="margin-bottom:4px;"><span class="md-badge">MD</span></div>':''))+
      '<div class="note-preview'+(n.format==='markdown'?' md':'')+'">'+(n.format==='markdown'?renderMd(n.content):esc(n.content))+'</div>'+
      tagsHtml+
      '<div class="note-date">'+new Date(n.updated_at).toLocaleDateString()+
      (n.reminder_at?' &bull; Reminder: '+new Date(n.reminder_at).toLocaleString():'')+
      '</div></div>';
  }).join('');
}

function toggleMdPreview() {
  var isMd = document.getElementById('n-markdown').checked;
  var previewBtn = document.getElementById('n-preview-btn');
  var previewEl = document.getElementById('n-md-preview');
  previewBtn.style.display = isMd ? 'inline-block' : 'none';
  if (isMd && previewEl.style.display !== 'none') {
    previewEl.innerHTML = renderMd(document.getElementById('n-content').value);
  } else if (!isMd) {
    previewEl.style.display = 'none';
  }
  if (isMd && previewBtn.textContent === 'Preview') {
    previewEl.style.display = 'block';
    previewEl.innerHTML = renderMd(document.getElementById('n-content').value);
    previewBtn.textContent = 'Edit';
  } else if (previewBtn.textContent === 'Edit') {
    previewEl.style.display = 'none';
    previewBtn.textContent = 'Preview';
  }
}

function openNote() {
  document.getElementById('note-modal-title').textContent = 'New Note';
  document.getElementById('n-id').value = '';
  document.getElementById('n-title').value = '';
  document.getElementById('n-content').value = '';
  document.getElementById('n-color').value = 'default';
  document.getElementById('n-reminder').value = '';
  document.getElementById('n-pinned').checked = false;
  document.getElementById('n-markdown').checked = false;
  document.getElementById('n-preview-btn').style.display = 'none';
  document.getElementById('n-md-preview').style.display = 'none';
  document.getElementById('n-delete-btn').style.display = 'none';
  currentTags = []; renderTags();
  document.getElementById('note-modal').classList.add('active');
}

async function openEditNote(id) {
  var notes = await fetch('/api/notes').then(r=>r.json());
  var n = notes.find(x=>x.id===id);
  if (!n) return;
  document.getElementById('note-modal-title').textContent = 'Edit Note';
  document.getElementById('n-id').value = id;
  document.getElementById('n-title').value = n.title||'';
  document.getElementById('n-content').value = n.content;
  document.getElementById('n-color').value = n.color||'default';
  document.getElementById('n-reminder').value = n.reminder_at?n.reminder_at.slice(0,16):'';
  document.getElementById('n-pinned').checked = n.pinned;
  document.getElementById('n-markdown').checked = n.format === 'markdown';
  document.getElementById('n-preview-btn').style.display = n.format === 'markdown' ? 'inline-block' : 'none';
  document.getElementById('n-preview-btn').textContent = 'Preview';
  document.getElementById('n-md-preview').style.display = 'none';
  document.getElementById('n-delete-btn').style.display = 'inline-block';
  currentTags = n.tags || []; renderTags();
  document.getElementById('note-modal').classList.add('active');
}

function closeNote() { document.getElementById('note-modal').classList.remove('active'); }

async function saveNote() {
  var data = {
    title: document.getElementById('n-title').value || null,
    content: document.getElementById('n-content').value,
    color: document.getElementById('n-color').value,
    pinned: document.getElementById('n-pinned').checked,
    reminder_at: document.getElementById('n-reminder').value ? new Date(document.getElementById('n-reminder').value).toISOString() : null,
    tags: currentTags.length ? currentTags : null,
    format: document.getElementById('n-markdown').checked ? 'markdown' : 'plain',
  };
  if (!data.content) return alert('Content is required');
  var id = document.getElementById('n-id').value;
  if (id) await fetch('/api/notes/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  else await fetch('/api/notes', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  closeNote(); load();
}

async function deleteNote() {
  var id = document.getElementById('n-id').value;
  await fetch('/api/notes/'+id, {method:'DELETE'});
  closeNote(); load();
  showUndo('Note moved to trash','note',id);
}


load();
</script>
</body></html>`);
});

// ============================================================================
// Page — Contacts
// ============================================================================
app.get("/contacts", (req, res) => {
  res.send(`${pageHead("Contacts")}
<body>
${themeScript()}
<div class="container">
  ${navBar("/contacts")}
  <h1>Contacts</h1>
  <p class="subtitle">Manage your email contacts for quick lookup</p>

  <div class="actions">
    <button class="primary" onclick="openAdd()">+ Add Contact</button>
  </div>

  <div class="section">
    <div id="contact-list"></div>
  </div>
</div>

<div class="modal-overlay" id="contact-modal">
  <div class="modal">
    <h2 id="c-modal-title">Add Contact</h2>
    <input type="hidden" id="c-id">
    <label>Name</label>
    <input type="text" id="c-name" placeholder="e.g. Mom, Boss, John">
    <label>Email</label>
    <input type="email" id="c-email" placeholder="email@example.com">
    <div class="modal-actions">
      <button onclick="closeContact()">Cancel</button>
      <button class="primary" onclick="saveContact()">Save</button>
      <button class="danger" id="c-delete-btn" style="display:none" onclick="deleteContact()">Delete</button>
    </div>
  </div>
</div>

<script>
async function load() {
  var contacts = await fetch('/api/contacts').then(r=>r.json());
  if (!contacts.length) { document.getElementById('contact-list').innerHTML = '<div class="empty-msg">No contacts yet. Add contacts to use quick email addressing.</div>'; return; }
  document.getElementById('contact-list').innerHTML = '<table><thead><tr><th>Name</th><th>Email</th><th>Actions</th></tr></thead><tbody>' +
    contacts.map(c => '<tr><td>'+esc(c.name)+'</td><td>'+esc(c.email)+'</td><td><div class="todo-actions"><button onclick="openEdit('+c.id+')">&#9998;</button><button class="delete" onclick="deleteDirect('+c.id+')">&#10005;</button></div></td></tr>').join('') +
    '</tbody></table>';
}

function openAdd() {
  document.getElementById('c-modal-title').textContent = 'Add Contact';
  document.getElementById('c-id').value = '';
  document.getElementById('c-name').value = '';
  document.getElementById('c-email').value = '';
  document.getElementById('c-delete-btn').style.display = 'none';
  document.getElementById('contact-modal').classList.add('active');
}

async function openEdit(id) {
  var contacts = await fetch('/api/contacts').then(r=>r.json());
  var c = contacts.find(x=>x.id===id);
  if (!c) return;
  document.getElementById('c-modal-title').textContent = 'Edit Contact';
  document.getElementById('c-id').value = id;
  document.getElementById('c-name').value = c.name;
  document.getElementById('c-email').value = c.email;
  document.getElementById('c-delete-btn').style.display = 'inline-block';
  document.getElementById('contact-modal').classList.add('active');
}

function closeContact() { document.getElementById('contact-modal').classList.remove('active'); }

async function saveContact() {
  var data = { name: document.getElementById('c-name').value, email: document.getElementById('c-email').value };
  if (!data.name || !data.email) return alert('Name and email are required');
  var id = document.getElementById('c-id').value;
  if (id) await fetch('/api/contacts/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  else {
    var r = await fetch('/api/contacts', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    var d = await r.json();
    if (d.error) return alert(d.error);
  }
  closeContact(); load();
}

async function deleteContact() {
  var id = document.getElementById('c-id').value;
  if (!confirm('Delete this contact?')) return;
  await fetch('/api/contacts/'+id, {method:'DELETE'});
  closeContact(); load();
}

async function deleteDirect(id) {
  if (!confirm('Delete this contact?')) return;
  await fetch('/api/contacts/'+id, {method:'DELETE'});
  load();
}


load();
</script>
</body></html>`);
});


// ============================================================================
// Page — Calendar
// ============================================================================
app.get("/calendar", (req, res) => {
  res.send(`${pageHead("Calendar")}
<body>
${themeScript()}
<div class="container">
  ${navBar("/calendar")}
  <h1>Calendar</h1>
  <p class="subtitle">Tasks, emails, and reminders at a glance</p>

  <div class="actions">
    <button onclick="prevMonth()">&larr; Previous</button>
    <span id="cal-title" style="font-size:18px;font-weight:300;padding:0 16px;"></span>
    <button onclick="nextMonth()">Next &rarr;</button>
    <a href="/api/calendar.ics" class="btn" style="margin-left:auto;" download>Export iCal</a>
    <button onclick="goToday()" style="margin-left:auto;">Today</button>
  </div>

  <div class="section">
    <div class="cal-grid">
      <div class="cal-header">Mon</div><div class="cal-header">Tue</div><div class="cal-header">Wed</div>
      <div class="cal-header">Thu</div><div class="cal-header">Fri</div><div class="cal-header">Sat</div><div class="cal-header">Sun</div>
    </div>
    <div class="cal-grid" id="cal-days"></div>
  </div>
</div>
<script>
var calMonth = new Date().getMonth();
var calYear = new Date().getFullYear();
function prevMonth() { calMonth--; if (calMonth<0){calMonth=11;calYear--;} load(); }
function nextMonth() { calMonth++; if (calMonth>11){calMonth=0;calYear++;} load(); }
function goToday() { calMonth=new Date().getMonth(); calYear=new Date().getFullYear(); load(); }

async function load() {
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-title').textContent = months[calMonth]+' '+calYear;
  var events = await fetch('/api/calendar?month='+(calMonth+1)+'&year='+calYear).then(r=>r.json());
  var firstDay = new Date(calYear, calMonth, 1).getDay();
  var startOffset = firstDay === 0 ? 6 : firstDay - 1; // Monday start
  var daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  var today = new Date(); today.setHours(0,0,0,0);
  var html = '';
  // Previous month padding
  var prevDays = new Date(calYear, calMonth, 0).getDate();
  for (var i = startOffset-1; i >= 0; i--) {
    html += '<div class="cal-day other-month"><div class="cal-day-num">'+(prevDays-i)+'</div></div>';
  }
  for (var d = 1; d <= daysInMonth; d++) {
    var date = new Date(calYear, calMonth, d);
    var isToday = date.getTime() === today.getTime();
    var dateStr = calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var dayEvents = events.filter(e => {
      var ed = new Date(e.event_date);
      return ed.getFullYear()===calYear && ed.getMonth()===calMonth && ed.getDate()===d;
    });
    html += '<div class="cal-day'+(isToday?' today':'')+'"><div class="cal-day-num">'+d+'</div>';
    dayEvents.slice(0,3).forEach(e => {
      html += '<div class="cal-event '+e.type+'">'+esc(e.title)+'</div>';
    });
    if (dayEvents.length > 3) html += '<div style="font-size:9px;color:var(--text-muted)">+'+(dayEvents.length-3)+' more</div>';
    html += '</div>';
  }
  // Next month padding
  var totalCells = startOffset + daysInMonth;
  var remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (var i = 1; i <= remaining; i++) {
    html += '<div class="cal-day other-month"><div class="cal-day-num">'+i+'</div></div>';
  }
  document.getElementById('cal-days').innerHTML = html;
}

load();
</script>
</body></html>`);
});

// ============================================================================
// Page — Weekly Review
// ============================================================================
app.get("/review", (req, res) => {
  res.send(`${pageHead("Weekly Review")}
<body>
${themeScript()}
<div class="container">
  ${navBar("/review")}
  <h1>Weekly Review</h1>
  <p class="subtitle" id="review-period"></p>

  <div class="top-cards" id="review-cards"></div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
    <div class="section">
      <h2>Completed This Week</h2>
      <div id="completed-list"></div>
    </div>
    <div class="section">
      <h2>Overdue Tasks</h2>
      <div id="overdue-list"></div>
    </div>
  </div>

  <!-- AI Summary -->
  <div id="review-summary-section" style="display:none;margin-top:24px;">
    <div class="section">
      <h2>AI Weekly Summary</h2>
      <div id="review-summary" style="font-size:14px;font-weight:300;line-height:1.7;"></div>
    </div>
  </div>

  <div class="section" style="margin-top:24px;">
    <h2>Coming Up Next Week</h2>
    <div id="next-week-list"></div>
  </div>
</div>
<script>
async function load() {
  var data = await fetch('/api/review').then(r=>r.json());
  document.getElementById('review-period').textContent =
    'Week of '+new Date(data.week_start).toLocaleDateString()+' — '+new Date(data.week_end).toLocaleDateString();

  document.getElementById('review-cards').innerHTML = [
    {label:'Tasks Completed',value:data.tasks_completed.length,cls:'green'},
    {label:'Tasks Created',value:data.tasks_created_count,cls:'warm'},
    {label:'Emails Sent',value:data.emails_sent_count,cls:'teal'},
    {label:'Notes Created',value:data.notes_created_count,cls:'blue'},
    {label:'Overdue',value:data.overdue_tasks.length,cls:data.overdue_tasks.length>0?'red':'green'},
  ].map(c => '<div class="card"><div class="label">'+c.label+'</div><div class="value '+c.cls+'">'+c.value+'</div></div>').join('');

  document.getElementById('completed-list').innerHTML = data.tasks_completed.length
    ? data.tasks_completed.map(t => '<div class="todo-item"><div class="todo-check done"></div><div class="todo-content"><div class="todo-title done">'+esc(t.title)+'</div><div class="todo-meta"><span class="badge '+t.priority+'">'+t.priority+'</span><span>'+new Date(t.completed_at).toLocaleDateString()+'</span></div></div></div>').join('')
    : '<div class="empty-msg">No tasks completed yet this week</div>';

  document.getElementById('overdue-list').innerHTML = data.overdue_tasks.length
    ? data.overdue_tasks.map(t => '<div class="todo-item"><div class="todo-content"><div class="todo-title" style="color:var(--red)">'+esc(t.title)+'</div><div class="todo-meta"><span class="badge '+t.priority+'">'+t.priority+'</span><span style="color:var(--red)">Due: '+new Date(t.due_date).toLocaleDateString()+'</span></div></div></div>').join('')
    : '<div class="empty-msg">No overdue tasks!</div>';

  document.getElementById('next-week-list').innerHTML = data.upcoming_tasks.length
    ? data.upcoming_tasks.map(t => '<div class="todo-item"><div class="todo-content"><div class="todo-title">'+esc(t.title)+'</div><div class="todo-meta"><span class="badge '+t.priority+'">'+t.priority+'</span><span>Due: '+new Date(t.due_date).toLocaleDateString()+'</span></div></div></div>').join('')
    : '<div class="empty-msg">No tasks scheduled for next week</div>';

  // Load AI review summary (non-blocking)
  fetch('/api/ai/review-summary', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stats:{
    tasks_completed: data.tasks_completed.length,
    tasks_created: data.tasks_created_count,
    emails_sent: data.emails_sent_count,
    notes_created: data.notes_created_count,
    overdue: data.overdue_tasks.length,
    completed_titles: data.tasks_completed.map(t=>t.title).join(', ')
  }})}).then(r=>r.json()).then(d => {
    if (d.summary) {
      document.getElementById('review-summary').textContent = d.summary;
      document.getElementById('review-summary-section').style.display = 'block';
    }
  }).catch(function(){});
}

load();
</script>
</body></html>`);
});

// ============================================================================
// Page — Settings
// ============================================================================
app.get("/settings", (req, res) => {
  res.send(`${pageHead("Settings")}
<body>
${themeScript()}
<div class="container">
  ${navBar("/settings")}
  <h1>Settings</h1>
  <p class="subtitle">Configure your personal assistant</p>

  <div id="status" class="status-msg"></div>

  <div class="section">
    <h2>Appearance</h2>
    <div style="display:flex;gap:12px;align-items:center;">
      <label style="margin:0;font-size:13px;color:var(--text);">Theme</label>
      <select id="s-theme" onchange="saveSettings()" style="width:auto;padding:8px 14px;font-size:13px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);">
        <option value="dark">Night Mode</option>
        <option value="light">Day Mode</option>
        <option value="auto">Auto (System)</option>
      </select>
    </div>
  </div>

  <div class="section">
    <h2>Session</h2>
    <div style="display:flex;gap:12px;align-items:center;">
      <label style="margin:0;font-size:13px;color:var(--text);">Timeout (minutes)</label>
      <input type="number" id="s-timeout" min="1" max="1440" style="width:100px;padding:8px 14px;font-size:13px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);">
      <button onclick="saveSettings()" style="padding:8px 16px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;">Save</button>
    </div>
  </div>

  <div class="section">
    <h2>Default Task Horizon</h2>
    <select id="s-horizon" onchange="saveSettings()" style="width:auto;padding:8px 14px;font-size:13px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);">
      <option value="short">Short-term</option>
      <option value="medium">Medium-term</option>
      <option value="long">Long-term</option>
    </select>
  </div>

  <div class="section">
    <h2>Perfin Integration</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Link to your Perfin (personal finance tracker) instance</p>
    <div style="display:flex;gap:12px;align-items:center;">
      <input type="url" id="s-perfin" placeholder="https://your-perfin-instance.onrender.com" style="flex:1;padding:8px 14px;font-size:13px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);">
      <button onclick="saveSettings()" style="padding:8px 16px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;">Save</button>
    </div>
  </div>

  <div class="section">
    <h2>AI Features</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;" id="ai-status"></p>
    <div id="ai-models-section" style="display:none;">
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:16px;">Choose a model for each AI feature. Sonnet is smarter but ~5x more expensive than Haiku. Set to Off to disable.</p>
      <div style="display:grid;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
          <div><div style="font-size:13px;font-weight:400;">Email Drafting</div><div style="font-size:10px;color:var(--text-muted);">AI-compose emails from a prompt</div></div>
          <select id="aim-email_draft" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
          <div><div style="font-size:13px;font-weight:400;">Task Breakdown</div><div style="font-size:10px;color:var(--text-muted);">Auto-generate subtasks from task title</div></div>
          <select id="aim-task_breakdown" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
          <div><div style="font-size:13px;font-weight:400;">Smart Quick Add</div><div style="font-size:10px;color:var(--text-muted);">AI-parse natural language into structured tasks</div></div>
          <select id="aim-quick_add" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
          <div><div style="font-size:13px;font-weight:400;">Weekly Review Summary</div><div style="font-size:10px;color:var(--text-muted);">AI-written narrative of your week</div></div>
          <select id="aim-review_summary" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
          <div><div style="font-size:13px;font-weight:400;">Email Tone Adjustment</div><div style="font-size:10px;color:var(--text-muted);">Rewrite emails in different tones</div></div>
          <select id="aim-email_tone" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
          <div><div style="font-size:13px;font-weight:400;">Daily Briefing</div><div style="font-size:10px;color:var(--text-muted);">AI summary of your day on the dashboard</div></div>
          <select id="aim-daily_briefing" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;">
          <div><div style="font-size:13px;font-weight:400;">Note Auto-Tagging</div><div style="font-size:10px;color:var(--text-muted);">Suggest tags when creating notes</div></div>
          <select id="aim-note_tagging" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Email (SMTP)</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;" id="smtp-status"></p>
  </div>

  <div class="section">
    <h2>Browser Notifications</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Get notified about reminders and overdue tasks</p>
    <div class="actions" style="margin-bottom:0;">
      <button onclick="enableNotifications()" id="notif-btn">Enable Notifications</button>
    </div>
  </div>

  <div class="section">
    <h2>Keyboard Shortcuts</h2>
    <div style="font-size:12px;color:var(--text-muted);line-height:2;">
      <span class="kbd">/</span> Focus search &middot;
      <span class="kbd">N</span> New task &middot;
      <span class="kbd">E</span> New email &middot;
      <span class="kbd">C</span> Calendar &middot;
      <span class="kbd">R</span> Weekly review &middot;
      <span class="kbd">Q</span> Quick add (on todos page) &middot;
      <span class="kbd">Esc</span> Close modals
    </div>
  </div>

  <div class="section">
    <h2>Data Export</h2>
    <div class="actions" style="margin-bottom:0;">
      <button onclick="exportData('todos')">Export Todos</button>
      <button onclick="exportData('emails')">Export Emails</button>
      <button onclick="exportData('notes')">Export Notes</button>
      <button onclick="exportData('contacts')">Export Contacts</button>
    </div>
  </div>

  <div class="section">
    <h2>Trash</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Deleted items are kept for 30 days before permanent removal.</p>
    <div id="trash-list" style="margin-bottom:10px;"></div>
    <div class="actions" style="margin-bottom:0;">
      <button onclick="loadTrash()">View Trash</button>
      <button class="danger" style="border-color:var(--red);color:var(--red);" onclick="emptyTrash()">Empty Trash</button>
    </div>
  </div>

  <div class="section">
    <h2>Automations</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Create rules that trigger actions automatically when events occur.</p>
    <div id="automations-list" style="margin-bottom:12px;"></div>
    <button onclick="openAutoModal()" style="padding:8px 16px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;text-transform:uppercase;">+ New Rule</button>
  </div>

  ${AUTH_SECRET ? '<div class="section"><h2>Session</h2><div class="actions" style="margin-bottom:0;"><button class="danger" style="border-color:var(--red);color:var(--red);" onclick="logout()">Log Out</button></div></div>' : ''}
</div>

<!-- Automation Modal -->
<div class="modal-overlay" id="auto-modal">
  <div class="modal">
    <h2 id="auto-modal-title">New Automation</h2>
    <input type="hidden" id="auto-id">
    <label>Name</label>
    <input type="text" id="auto-name" placeholder="e.g. Auto-prioritize work tasks">
    <label>When (Trigger)</label>
    <select id="auto-trigger" style="width:100%;padding:10px 14px;font-size:14px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);">
      <option value="todo_created">Task Created</option>
      <option value="todo_completed">Task Completed</option>
      <option value="email_created">Email Created</option>
      <option value="note_created">Note Created</option>
    </select>
    <label>If (Condition — optional)</label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <select id="auto-cond-field" style="width:100%;padding:8px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);">
          <option value="">Any</option>
          <option value="category">Category equals</option>
          <option value="priority">Priority equals</option>
          <option value="title_contains">Title contains</option>
          <option value="horizon">Horizon equals</option>
        </select>
      </div>
      <input type="text" id="auto-cond-value" placeholder="Value..." style="padding:8px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);">
    </div>
    <label>Then (Action)</label>
    <select id="auto-action" style="width:100%;padding:10px 14px;font-size:14px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);" onchange="updateActionFields()">
      <option value="set_priority">Set Priority</option>
      <option value="set_category">Set Category</option>
      <option value="set_horizon">Set Horizon</option>
      <option value="add_tag">Add Tag (notes)</option>
      <option value="create_todo">Create Follow-up Task</option>
    </select>
    <label>Action Value</label>
    <input type="text" id="auto-action-value" placeholder="e.g. urgent, work, short...">
    <div class="modal-actions">
      <button onclick="closeAutoModal()">Cancel</button>
      <button class="primary" onclick="saveAutomation()">Save</button>
      <button class="danger" id="auto-delete-btn" style="display:none" onclick="deleteAutomation()">Delete</button>
    </div>
  </div>
</div>

<script>
function applyTheme(t) {
  var effective = t;
  if (t === 'auto') effective = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  if (effective === 'light') document.documentElement.setAttribute('data-theme','light');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('theme', t);
}
async function load() {
  var s = await fetch('/api/settings').then(r=>r.json());
  document.getElementById('s-theme').value = s.theme || 'dark';
  document.getElementById('s-timeout').value = s.session_timeout_minutes || 15;
  document.getElementById('s-horizon').value = s.default_horizon || 'short';
  document.getElementById('s-perfin').value = s.perfin_url || '';
  document.getElementById('smtp-status').textContent = s.smtp_configured
    ? 'SMTP is configured and ready to send emails.'
    : 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to enable email sending.';
  document.getElementById('ai-status').textContent = s.ai_configured
    ? 'Claude AI is configured. Manage model preferences for each feature below.'
    : 'Not configured. Set ANTHROPIC_API_KEY in .env to enable AI features.';
  if (s.ai_configured) {
    document.getElementById('ai-models-section').style.display = 'block';
    try {
      var models = await fetch('/api/ai/models').then(r=>r.json());
      var features = ['email_draft','task_breakdown','quick_add','review_summary','email_tone','daily_briefing','note_tagging'];
      features.forEach(f => {
        var el = document.getElementById('aim-'+f);
        if (el) el.value = models['ai_model_'+f] || 'off';
      });
    } catch {}
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    document.getElementById('notif-btn').textContent = 'Notifications Enabled';
    document.getElementById('notif-btn').disabled = true;
  }

  // Apply theme
  applyTheme(s.theme || 'dark');
}

async function saveSettings() {
  var data = {
    theme: document.getElementById('s-theme').value,
    session_timeout_minutes: parseInt(document.getElementById('s-timeout').value) || 15,
    default_horizon: document.getElementById('s-horizon').value,
    perfin_url: document.getElementById('s-perfin').value || null,
  };
  await fetch('/api/settings', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});

  // Apply theme immediately
  applyTheme(data.theme);

  var el = document.getElementById('status');
  el.className = 'status-msg success';
  el.textContent = 'Settings saved.';
  setTimeout(()=>{ el.className = 'status-msg'; }, 3000);
}

async function exportData(type) {
  var data = await fetch('/api/'+type).then(r=>r.json());
  var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = type+'-export-'+new Date().toISOString().split('T')[0]+'.json';
  a.click();
}

async function saveAIModels() {
  var data = {};
  var features = ['email_draft','task_breakdown','quick_add','review_summary','email_tone','daily_briefing','note_tagging'];
  features.forEach(f => { data['ai_model_'+f] = document.getElementById('aim-'+f).value; });
  await fetch('/api/ai/models', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  var el = document.getElementById('status');
  el.className = 'status-msg success';
  el.textContent = 'AI model preferences saved.';
  setTimeout(()=>{ el.className = 'status-msg'; }, 3000);
}

async function enableNotifications() {
  if (!('Notification' in window)) return alert('Browser does not support notifications');
  var perm = await Notification.requestPermission();
  if (perm === 'granted') {
    document.getElementById('notif-btn').textContent = 'Notifications Enabled';
    document.getElementById('notif-btn').disabled = true;
    new Notification('Per-sistant', { body: 'Notifications enabled! You will be notified about reminders and overdue tasks.' });
  }
}

async function loadTrash() {
  var items = await fetch('/api/trash').then(r=>r.json());
  var el = document.getElementById('trash-list');
  if (!items.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Trash is empty.</div>'; return; }
  el.innerHTML = items.map(function(item) {
    var d = new Date(item.deleted_at).toLocaleDateString();
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">'
      +'<div><span style="color:var(--text-muted);font-size:11px;margin-right:8px;">'+item.type+'</span>'+esc(item.title||'Untitled')+'<span style="color:var(--text-muted);font-size:11px;margin-left:8px;">deleted '+d+'</span></div>'
      +'<div style="display:flex;gap:6px;">'
      +'<button onclick="restoreItem(\''+item.type+'\','+item.id+')" style="background:var(--green-bg);color:var(--green);border:1px solid var(--green);padding:3px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit;">Restore</button>'
      +'<button onclick="permanentDelete(\''+item.type+'\','+item.id+')" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);padding:3px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit;">Delete</button>'
      +'</div></div>';
  }).join('');
}

async function restoreItem(type, id) {
  await fetch('/api/trash/'+type+'/'+id+'/restore', {method:'POST'});
  loadTrash();
  var el = document.getElementById('status');
  el.className = 'status-msg success'; el.textContent = 'Item restored.';
  setTimeout(function(){ el.className = 'status-msg'; }, 3000);
}

async function permanentDelete(type, id) {
  if (!confirm('Permanently delete this item? This cannot be undone.')) return;
  await fetch('/api/trash/'+type+'/'+id, {method:'DELETE'});
  loadTrash();
}

async function emptyTrash() {
  if (!confirm('Permanently delete all items in trash? This cannot be undone.')) return;
  await fetch('/api/trash/empty', {method:'POST'});
  loadTrash();
  var el = document.getElementById('status');
  el.className = 'status-msg success'; el.textContent = 'Trash emptied.';
  setTimeout(function(){ el.className = 'status-msg'; }, 3000);
}

// Automations
async function loadAutomations() {
  var autos = await fetch('/api/automations').then(r=>r.json());
  var el = document.getElementById('automations-list');
  if (!autos.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">No automation rules configured.</div>'; return; }
  el.innerHTML = autos.map(a => {
    var condText = '';
    if (a.conditions) {
      var keys = Object.keys(a.conditions).filter(k=>a.conditions[k]);
      condText = keys.length ? ' when ' + keys.map(k=>k+'='+a.conditions[k]).join(' & ') : '';
    }
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;">'
      +'<div style="flex:1;"><div style="font-weight:400;">'+esc(a.name)+'</div>'
      +'<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">'+a.trigger_type+condText+' &rarr; '+a.action_type+'</div></div>'
      +'<div style="display:flex;gap:6px;align-items:center;">'
      +'<button onclick="toggleAutomation('+a.id+','+!a.enabled+')" style="background:'+(a.enabled?'var(--green-bg)':'var(--surface-2)')+';color:'+(a.enabled?'var(--green)':'var(--text-muted)')+';border:1px solid '+(a.enabled?'var(--green)':'var(--border)')+';padding:3px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-family:inherit;">'+(a.enabled?'On':'Off')+'</button>'
      +'<button onclick="editAutomation('+a.id+')" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:3px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-family:inherit;">Edit</button>'
      +'</div></div>';
  }).join('');
}
function openAutoModal() {
  document.getElementById('auto-modal-title').textContent = 'New Automation';
  document.getElementById('auto-id').value = '';
  document.getElementById('auto-name').value = '';
  document.getElementById('auto-trigger').value = 'todo_created';
  document.getElementById('auto-cond-field').value = '';
  document.getElementById('auto-cond-value').value = '';
  document.getElementById('auto-action').value = 'set_priority';
  document.getElementById('auto-action-value').value = '';
  document.getElementById('auto-delete-btn').style.display = 'none';
  document.getElementById('auto-modal').classList.add('active');
}
function closeAutoModal() { document.getElementById('auto-modal').classList.remove('active'); }
async function editAutomation(id) {
  var autos = await fetch('/api/automations').then(r=>r.json());
  var a = autos.find(x=>x.id===id); if (!a) return;
  document.getElementById('auto-modal-title').textContent = 'Edit Automation';
  document.getElementById('auto-id').value = id;
  document.getElementById('auto-name').value = a.name;
  document.getElementById('auto-trigger').value = a.trigger_type;
  var condKeys = Object.keys(a.conditions||{}).filter(k=>a.conditions[k]);
  document.getElementById('auto-cond-field').value = condKeys[0] || '';
  document.getElementById('auto-cond-value').value = condKeys.length ? a.conditions[condKeys[0]] : '';
  document.getElementById('auto-action').value = a.action_type;
  var actData = a.action_data||{};
  document.getElementById('auto-action-value').value = actData[Object.keys(actData)[0]] || '';
  document.getElementById('auto-delete-btn').style.display = 'inline-block';
  document.getElementById('auto-modal').classList.add('active');
}
async function saveAutomation() {
  var id = document.getElementById('auto-id').value;
  var condField = document.getElementById('auto-cond-field').value;
  var condValue = document.getElementById('auto-cond-value').value;
  var actionType = document.getElementById('auto-action').value;
  var actionValue = document.getElementById('auto-action-value').value;
  var conditions = {};
  if (condField && condValue) conditions[condField] = condValue;
  var actionKey = actionType === 'set_priority' ? 'priority' : actionType === 'set_category' ? 'category' : actionType === 'set_horizon' ? 'horizon' : actionType === 'add_tag' ? 'tag' : 'title';
  var action_data = {}; action_data[actionKey] = actionValue;
  var data = {
    name: document.getElementById('auto-name').value,
    trigger_type: document.getElementById('auto-trigger').value,
    conditions: conditions,
    action_type: actionType,
    action_data: action_data,
  };
  if (!data.name) return alert('Name is required');
  if (id) await fetch('/api/automations/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  else await fetch('/api/automations', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  closeAutoModal(); loadAutomations();
}
async function deleteAutomation() {
  var id = document.getElementById('auto-id').value;
  await fetch('/api/automations/'+id, {method:'DELETE'});
  closeAutoModal(); loadAutomations();
}
async function toggleAutomation(id, enabled) {
  await fetch('/api/automations/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});
  loadAutomations();
}
function updateActionFields() {}

async function logout() {
  await fetch('/api/logout', {method:'POST'});
  location.href = '/login';
}

load();
loadAutomations();
</script>
</body></html>`);
});

// ============================================================================
// PWA — Manifest & Service Worker
// ============================================================================
app.get("/manifest.json", (req, res) => {
  res.json({
    name: "Per-sistant",
    short_name: "Per-sistant",
    description: "Personal assistant — tasks, emails, notes",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0b14",
    theme_color: "#0a0b14",
    icons: [
      { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
  });
});

app.get("/sw.js", (req, res) => {
  res.type("application/javascript").send(`
    const CACHE = 'per-sistant-v2';
    const PAGES = ['/', '/todos', '/emails', '/notes', '/calendar', '/contacts', '/review', '/settings'];
    const OFFLINE_KEY = 'per-sistant-offline-queue';

    self.addEventListener('install', e => {
      e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PAGES)).then(() => self.skipWaiting()));
    });

    self.addEventListener('activate', e => {
      e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
    });

    self.addEventListener('fetch', e => {
      const url = new URL(e.request.url);
      // API requests: network-first, cache fallback for GET
      if (url.pathname.startsWith('/api/')) {
        if (e.request.method === 'GET') {
          e.respondWith(
            fetch(e.request).then(r => {
              const rc = r.clone();
              caches.open(CACHE).then(cache => cache.put(e.request, rc));
              return r;
            }).catch(() => caches.match(e.request))
          );
        } else {
          // POST/PATCH/DELETE: try network, queue if offline
          e.respondWith(
            fetch(e.request.clone()).catch(async () => {
              // Store in offline queue for sync later
              const body = await e.request.clone().text();
              const queue = JSON.parse(await (await caches.match(OFFLINE_KEY))?.text() || '[]');
              queue.push({ url: e.request.url, method: e.request.method, body, headers: Object.fromEntries(e.request.headers) });
              const queueResponse = new Response(JSON.stringify(queue));
              await caches.open(CACHE).then(c => c.put(OFFLINE_KEY, queueResponse));
              return new Response(JSON.stringify({ ok: true, offline: true }), { headers: { 'Content-Type': 'application/json' } });
            })
          );
        }
        return;
      }
      // Page requests: network-first with cache fallback
      e.respondWith(
        fetch(e.request).then(r => {
          const rc = r.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, rc));
          return r;
        }).catch(() => caches.match(e.request))
      );
    });

    // Sync offline queue when back online
    self.addEventListener('message', e => {
      if (e.data === 'sync') {
        caches.open(CACHE).then(async cache => {
          const resp = await cache.match(OFFLINE_KEY);
          if (!resp) return;
          const queue = JSON.parse(await resp.text());
          for (const req of queue) {
            try {
              await fetch(req.url, { method: req.method, body: req.body, headers: req.headers });
            } catch {}
          }
          await cache.delete(OFFLINE_KEY);
          self.clients.matchAll().then(clients => clients.forEach(c => c.postMessage('synced')));
        });
      }
    });
  `);
});

// SVG icon
const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#0a0b14"/>
  <text x="256" y="340" font-family="Inter,sans-serif" font-size="280" font-weight="300" fill="#a08cd4" text-anchor="middle">P</text>
</svg>`;

app.get("/icon-192.svg", (req, res) => res.type("image/svg+xml").send(SVG_ICON));
app.get("/icon-512.svg", (req, res) => res.type("image/svg+xml").send(SVG_ICON));

// ============================================================================
// Email scheduler (cron job — checks every minute for due emails)
// ============================================================================
async function processScheduledEmails() {
  if (!nodemailer || !process.env.SMTP_HOST) return;
  try {
    const r = await pool.query(
      "SELECT * FROM emails WHERE deleted_at IS NULL AND status = 'scheduled' AND scheduled_at <= now()"
    );
    for (const email of r.rows) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          secure: process.env.SMTP_PORT === "465",
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email.recipient_email,
          subject: email.subject,
          text: email.body,
        });
        await pool.query("UPDATE emails SET status = 'sent', sent_at = now() WHERE id = $1", [email.id]);
        console.log(`Sent scheduled email ${email.id} to ${email.recipient_email}`);
      } catch (err) {
        await pool.query("UPDATE emails SET status = 'failed', error_message = $1 WHERE id = $2", [err.message, email.id]);
        console.error(`Failed to send email ${email.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("Email scheduler error:", err.message);
  }
}

// ============================================================================
// Start server
// ============================================================================
const PORT = parseInt(process.env.PORT || "3001", 10);

async function start() {
  if (process.env.NEON_DATABASE_URL) {
    await runMigrations();
  } else {
    console.log("No NEON_DATABASE_URL set — running without database (API calls will fail)");
  }

  // Start email scheduler (every minute)
  if (cron) {
    cron.schedule("* * * * *", processScheduledEmails);
    console.log("Email scheduler started (checks every minute)");
  }

  // Process recurring tasks — auto-generate next instance for overdue recurring
  if (cron) {
    cron.schedule("0 0 * * *", async () => {
      try {
        const r = await pool.query("SELECT * FROM todos WHERE deleted_at IS NULL AND recurring = true AND completed = false AND due_date < CURRENT_DATE");
        for (const todo of r.rows) {
          // Auto-complete and reset streak (overdue = missed)
          await pool.query("UPDATE todos SET completed = true, completed_at = now(), streak_count = 0 WHERE id = $1", [todo.id]);
          const rule = todo.recurrence_rule;
          let nextDue = new Date(todo.due_date);
          if (rule === "daily") nextDue.setDate(nextDue.getDate() + 1);
          else if (rule === "weekdays") { do { nextDue.setDate(nextDue.getDate() + 1); } while (nextDue.getDay() === 0 || nextDue.getDay() === 6); }
          else if (rule === "weekly") nextDue.setDate(nextDue.getDate() + 7);
          else if (rule === "monthly") nextDue.setMonth(nextDue.getMonth() + 1);
          else if (rule === "yearly") nextDue.setFullYear(nextDue.getFullYear() + 1);
          let catchupLimit = 365;
          while (nextDue <= new Date() && catchupLimit-- > 0) {
            if (rule === "daily") nextDue.setDate(nextDue.getDate() + 1);
            else if (rule === "weekly") nextDue.setDate(nextDue.getDate() + 7);
            else if (rule === "monthly") nextDue.setMonth(nextDue.getMonth() + 1);
            else break;
          }
          await pool.query(
            "INSERT INTO todos (title, description, priority, horizon, category, due_date, recurring, recurrence_rule, recurrence_parent_id, streak_count, best_streak) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10)",
            [todo.title, todo.description, todo.priority, todo.horizon, todo.category, nextDue.toISOString().split("T")[0], true, rule, todo.recurrence_parent_id || todo.id, todo.best_streak || 0]
          );
        }
        if (r.rows.length) console.log(`Processed ${r.rows.length} recurring tasks`);
      } catch (err) { console.error("Recurring task error:", err.message); }
    });
    console.log("Recurring task processor started (daily at midnight)");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Per-sistant running on http://localhost:${PORT}`);
    if (PERFIN_URL) console.log(`Linked to Perfin: ${PERFIN_URL}`);
    if (AUTH_SECRET) console.log(`Authentication: ${AUTH_MODE} mode`);
    if (process.env.SMTP_HOST) console.log("SMTP configured for email sending");
  });
}

start().catch(console.error);

module.exports = { app, pool, processScheduledEmails, parseTimeExpr: null };
