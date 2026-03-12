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

let nodemailer;
try { nodemailer = require("nodemailer"); } catch { nodemailer = null; }

let cron;
try { cron = require("node-cron"); } catch { cron = null; }

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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

// ---------------------------------------------------------------------------
// Shared CSS — matches Perfin design system exactly
// ---------------------------------------------------------------------------
const SHARED_CSS = `
    :root {
      --bg: #080b12; --surface: rgba(255,255,255,0.04); --surface-2: rgba(255,255,255,0.07);
      --border: rgba(255,255,255,0.08); --border-hover: rgba(255,255,255,0.18);
      --text: #f0ebe3; --text-muted: rgba(240,235,227,0.5);
      --warm: #d4a574; --warm-glow: #c8856c; --teal: #5a8f8f;
      --green: #6fcf97; --green-bg: rgba(111,207,151,0.1);
      --red: #eb6b6b; --red-bg: rgba(235,107,107,0.1);
      --yellow: #f0c36d; --yellow-bg: rgba(240,195,109,0.1);
      --blue: #7fb5e6; --blue-bg: rgba(127,181,230,0.1);
      --radius: 12px;
    }
    [data-theme="light"] {
      --bg: #f5f2ed; --surface: rgba(0,0,0,0.03); --surface-2: rgba(0,0,0,0.06);
      --border: rgba(0,0,0,0.10); --border-hover: rgba(0,0,0,0.20);
      --text: #1a1a2e; --text-muted: rgba(26,26,46,0.5);
      --warm: #b07a4a; --warm-glow: #a0684c; --teal: #3d7272;
      --green: #2d9f5f; --green-bg: rgba(45,159,95,0.1);
      --red: #c94444; --red-bg: rgba(201,68,68,0.1);
      --yellow: #c49a2a; --yellow-bg: rgba(196,154,42,0.1);
      --blue: #4a8abf; --blue-bg: rgba(74,138,191,0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif; background: var(--bg);
      color: var(--text); min-height: 100vh; position: relative; overflow-x: hidden;
    }
    body::before {
      content: ''; position: fixed; top: -30%; right: -20%; width: 90vw; height: 90vh;
      background: radial-gradient(ellipse at 50% 30%, rgba(200,133,108,0.28) 0%, rgba(180,120,100,0.15) 25%, rgba(90,143,143,0.12) 50%, transparent 75%);
      pointer-events: none; z-index: 0; filter: blur(50px);
    }
    body::after {
      content: ''; position: fixed; bottom: -20%; left: -15%; width: 80vw; height: 70vh;
      background: radial-gradient(ellipse at 40% 60%, rgba(90,143,143,0.20) 0%, rgba(212,165,116,0.10) 35%, rgba(160,100,80,0.05) 60%, transparent 80%);
      pointer-events: none; z-index: 0; filter: blur(60px);
    }
    [data-theme="light"] body::before {
      background: radial-gradient(ellipse at 50% 30%, rgba(200,133,108,0.12) 0%, rgba(90,143,143,0.06) 50%, transparent 75%);
    }
    [data-theme="light"] body::after {
      background: radial-gradient(ellipse at 40% 60%, rgba(90,143,143,0.10) 0%, rgba(212,165,116,0.05) 35%, transparent 80%);
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
    .todo-check { width: 20px; height: 20px; border: 2px solid var(--border); border-radius: 50%;
                  cursor: pointer; flex-shrink: 0; margin-top: 2px; transition: all 0.2s;
                  display: flex; align-items: center; justify-content: center; }
    .todo-check:hover { border-color: var(--warm); }
    .todo-check.done { border-color: var(--green); background: var(--green); }
    .todo-check.done::after { content: '\\2713'; color: var(--bg); font-size: 12px; font-weight: 700; }
    .todo-content { flex: 1; min-width: 0; }
    .todo-title { font-size: 14px; font-weight: 400; }
    .todo-title.done { text-decoration: line-through; opacity: 0.4; }
    .todo-meta { font-size: 11px; color: var(--text-muted); margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap; }
    .todo-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .todo-actions button { background: none; border: none; color: var(--text-muted); cursor: pointer;
                           font-size: 14px; padding: 4px; transition: color 0.2s; }
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
    .note-card .note-date { font-size: 10px; color: var(--text-muted); margin-top: 12px;
                            text-transform: uppercase; letter-spacing: 0.5px; }

    /* Filters */
    .filters { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .filters button { padding: 6px 14px; font-size: 11px; font-weight: 500; letter-spacing: 0.5px;
      border: 1px solid var(--border); border-radius: 20px; cursor: pointer;
      background: transparent; color: var(--text-muted); font-family: inherit; transition: all 0.2s; }
    .filters button:hover { border-color: var(--warm); color: var(--text); }
    .filters button.active { border-color: var(--warm); color: var(--warm); background: rgba(212,165,116,0.08); }

    @media (max-width: 768px) {
      .topnav { flex-direction: column; gap: 12px; align-items: flex-start; }
      .topnav .nav-links { gap: 16px; flex-wrap: wrap; }
      h1 { font-size: 28px; }
      .top-cards { grid-template-columns: repeat(2, 1fr); }
      .notes-grid { grid-template-columns: 1fr; }
      .modal { width: 95%; padding: 24px; }
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
  <meta name="theme-color" content="#080b12">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${SHARED_CSS}</style>
</head>`;
}

function navBar(activePage) {
  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/todos", label: "To-Dos" },
    { href: "/emails", label: "Emails" },
    { href: "/notes", label: "Notes" },
    { href: "/contacts", label: "Contacts" },
    { href: "/settings", label: "Settings" },
  ];
  const perfinLink = PERFIN_URL ? `<a href="${PERFIN_URL}" target="_blank">Perfin</a>` : "";
  return `<nav class="topnav">
    <div class="logo">Per-sistant</div>
    <div class="nav-links">
      ${links.map(l => `<a href="${l.href}" class="${activePage === l.href ? 'active' : ''}">${l.label}</a>`).join("\n      ")}
      ${perfinLink}
    </div>
  </nav>`;
}

function themeScript() {
  return `<script>
    (function(){
      var t = localStorage.getItem('theme') || 'dark';
      if (t === 'light') document.documentElement.setAttribute('data-theme','light');
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
      <div style="display:grid;grid-template-columns:repeat(3,60px);gap:10px;justify-content:center;">
        ${[1,2,3,4,5,6,7,8,9,'',0,'<'].map(k => k === '' ? '<div></div>' :
          `<button onclick="${k === '<' ? 'pinDel()' : 'pinAdd('+k+')'}" style="width:60px;height:60px;border-radius:50%;border:1px solid var(--border);background:transparent;color:var(--text);font-size:22px;font-weight:300;cursor:pointer;font-family:inherit;transition:all 0.2s;">${k === '<' ? '&#9003;' : k}</button>`
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
    const { horizon, priority, completed, category } = req.query;
    let where = [];
    let params = [];
    let idx = 1;
    if (horizon) { where.push(`horizon = $${idx++}`); params.push(horizon); }
    if (priority) { where.push(`priority = $${idx++}`); params.push(priority); }
    if (completed !== undefined) { where.push(`completed = $${idx++}`); params.push(completed === "true"); }
    if (category) { where.push(`category = $${idx++}`); params.push(category); }
    const clause = where.length ? "WHERE " + where.join(" AND ") : "";
    const r = await pool.query(`SELECT * FROM todos ${clause} ORDER BY completed ASC, sort_order ASC, CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC`, params);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/todos", async (req, res) => {
  try {
    const { title, description, priority, horizon, category, due_date } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required." });
    const r = await pool.query(
      `INSERT INTO todos (title, description, priority, horizon, category, due_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, description || null, priority || "medium", horizon || "short", category || null, due_date || null]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/todos/:id", async (req, res) => {
  try {
    const { title, description, priority, horizon, category, due_date, completed, sort_order } = req.body;
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
    if (completed !== undefined) {
      fields.push(`completed = $${idx++}`); params.push(completed);
      fields.push(`completed_at = $${idx++}`); params.push(completed ? new Date().toISOString() : null);
    }
    if (!fields.length) return res.status(400).json({ error: "No fields to update." });
    params.push(req.params.id);
    const r = await pool.query(`UPDATE todos SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, params);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/todos/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM todos WHERE id = $1 RETURNING id", [req.params.id]);
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
    const where = status ? "WHERE status = $1" : "";
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
    const r = await pool.query("DELETE FROM emails WHERE id = $1 RETURNING id", [req.params.id]);
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
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || "587"),
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
    const r = await pool.query("SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC");
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/notes", async (req, res) => {
  try {
    const { title, content, pinned, color, reminder_at } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required." });
    const r = await pool.query(
      `INSERT INTO notes (title, content, pinned, color, reminder_at) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title || null, content, pinned || false, color || "default", reminder_at || null]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/notes/:id", async (req, res) => {
  try {
    const { title, content, pinned, color, reminder_at } = req.body;
    const fields = [];
    const params = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title = $${idx++}`); params.push(title); }
    if (content !== undefined) { fields.push(`content = $${idx++}`); params.push(content); }
    if (pinned !== undefined) { fields.push(`pinned = $${idx++}`); params.push(pinned); }
    if (color !== undefined) { fields.push(`color = $${idx++}`); params.push(color); }
    if (reminder_at !== undefined) { fields.push(`reminder_at = $${idx++}`); params.push(reminder_at); }
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
    const r = await pool.query("DELETE FROM notes WHERE id = $1 RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found." });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    settings.perfin_url = PERFIN_URL || settings.perfin_url || null;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/settings", async (req, res) => {
  try {
    const { theme, session_timeout_minutes, default_horizon, perfin_url } = req.body;
    const fields = [];
    const params = [];
    let idx = 1;
    if (theme !== undefined) { fields.push(`theme = $${idx++}`); params.push(theme); }
    if (session_timeout_minutes !== undefined) { fields.push(`session_timeout_minutes = $${idx++}`); params.push(session_timeout_minutes); }
    if (default_horizon !== undefined) { fields.push(`default_horizon = $${idx++}`); params.push(default_horizon); }
    if (perfin_url !== undefined) { fields.push(`perfin_url = $${idx++}`); params.push(perfin_url || null); }
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
      pool.query("SELECT count(*) FILTER (WHERE NOT completed) as pending, count(*) FILTER (WHERE completed) as done, count(*) FILTER (WHERE NOT completed AND priority = 'urgent') as urgent, count(*) FILTER (WHERE NOT completed AND due_date <= CURRENT_DATE) as overdue FROM todos"),
      pool.query("SELECT count(*) FILTER (WHERE status = 'draft') as drafts, count(*) FILTER (WHERE status = 'scheduled') as scheduled, count(*) FILTER (WHERE status = 'sent') as sent FROM emails"),
      pool.query("SELECT count(*) as total FROM notes"),
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
// Page — Dashboard
// ============================================================================
app.get("/", async (req, res) => {
  res.send(`${pageHead("Dashboard")}
<body>
${themeScript()}
<div class="container">
  ${navBar("/")}
  <h1>Dashboard</h1>
  <p class="subtitle">Your personal command center</p>

  <div class="top-cards" id="cards"></div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
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
<script>
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

  const todos = await fetch('/api/todos?completed=false').then(r=>r.json());
  const upcoming = todos.filter(t=>t.due_date).sort((a,b)=>new Date(a.due_date)-new Date(b.due_date)).slice(0,5);
  document.getElementById('upcoming-tasks').innerHTML = upcoming.length
    ? upcoming.map(t => '<div class="todo-item"><div class="todo-content"><div class="todo-title">'+esc(t.title)+'</div><div class="todo-meta"><span class="badge '+t.priority+'">'+t.priority+'</span><span>Due: '+new Date(t.due_date).toLocaleDateString()+'</span></div></div></div>').join('')
    : '<div class="empty-msg">No upcoming tasks with due dates</div>';

  const emails = await fetch('/api/emails?status=scheduled').then(r=>r.json());
  document.getElementById('scheduled-emails').innerHTML = emails.length
    ? emails.slice(0,5).map(e => '<div class="todo-item"><div class="todo-content"><div class="todo-title">'+esc(e.subject)+'</div><div class="todo-meta"><span>To: '+esc(e.recipient_name||e.recipient_email)+'</span><span>'+new Date(e.scheduled_at).toLocaleString()+'</span></div></div></div>').join('')
    : '<div class="empty-msg">No scheduled emails</div>';
}
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
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
        <input type="text" id="f-category" placeholder="e.g. work, personal"></div>
      <div><label>Due Date</label>
        <input type="date" id="f-due"></div>
    </div>
    <div class="modal-actions">
      <button onclick="closeModal()">Cancel</button>
      <button class="primary" onclick="saveTodo()">Save</button>
      <button class="danger" id="delete-btn" style="display:none" onclick="deleteTodo()">Delete</button>
    </div>
  </div>
</div>

<script>
var curHorizon = '', curStatus = 'pending';
function setHorizon(btn, h) { curHorizon = h; document.querySelectorAll('#horizon-filters button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); load(); }
function setStatus(btn, s) { curStatus = s; document.querySelectorAll('#status-filters button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); load(); }

async function load() {
  var q = [];
  if (curHorizon) q.push('horizon='+curHorizon);
  if (curStatus === 'pending') q.push('completed=false');
  else if (curStatus === 'done') q.push('completed=true');
  var todos = await fetch('/api/todos'+(q.length?'?'+q.join('&'):'')).then(r=>r.json());
  if (!todos.length) { document.getElementById('todo-list').innerHTML = '<div class="empty-msg">No tasks found</div>'; return; }
  document.getElementById('todo-list').innerHTML = todos.map(t => {
    var dueTxt = t.due_date ? 'Due: '+new Date(t.due_date).toLocaleDateString() : '';
    var overdue = t.due_date && !t.completed && new Date(t.due_date) <= new Date() ? ' style="color:var(--red)"' : '';
    return '<div class="todo-item"><div class="todo-check'+(t.completed?' done':'')+'" onclick="toggleTodo('+t.id+','+!t.completed+')"></div><div class="todo-content"><div class="todo-title'+(t.completed?' done':'')+'">'+esc(t.title)+'</div><div class="todo-meta"><span class="badge '+t.priority+'">'+t.priority+'</span><span class="badge '+t.horizon+'">'+t.horizon+'</span>'+(t.category?'<span>'+esc(t.category)+'</span>':'')+(dueTxt?'<span'+overdue+'>'+dueTxt+'</span>':'')+'</div>'+(t.description?'<div style="font-size:12px;color:var(--text-muted);margin-top:4px;font-weight:300">'+esc(t.description)+'</div>':'')+'</div><div class="todo-actions"><button onclick="openEdit('+t.id+')">&#9998;</button></div></div>';
  }).join('');
}

function openAdd() {
  document.getElementById('modal-title').textContent = 'New Task';
  document.getElementById('edit-id').value = '';
  document.getElementById('f-title').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('f-priority').value = 'medium';
  document.getElementById('f-horizon').value = 'short';
  document.getElementById('f-category').value = '';
  document.getElementById('f-due').value = '';
  document.getElementById('delete-btn').style.display = 'none';
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
  document.getElementById('f-category').value = t.category||'';
  document.getElementById('f-due').value = t.due_date?t.due_date.split('T')[0]:'';
  document.getElementById('delete-btn').style.display = 'inline-block';
  document.getElementById('modal').classList.add('active');
}

function closeModal() { document.getElementById('modal').classList.remove('active'); }

async function saveTodo() {
  var id = document.getElementById('edit-id').value;
  var data = {
    title: document.getElementById('f-title').value,
    description: document.getElementById('f-desc').value || null,
    priority: document.getElementById('f-priority').value,
    horizon: document.getElementById('f-horizon').value,
    category: document.getElementById('f-category').value || null,
    due_date: document.getElementById('f-due').value || null,
  };
  if (!data.title) return alert('Title is required');
  if (id) await fetch('/api/todos/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  else await fetch('/api/todos', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  closeModal(); load();
}

async function toggleTodo(id, completed) {
  await fetch('/api/todos/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed})});
  load();
}

async function deleteTodo() {
  var id = document.getElementById('edit-id').value;
  if (!confirm('Delete this task?')) return;
  await fetch('/api/todos/'+id, {method:'DELETE'});
  closeModal(); load();
}

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
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
    <label>Body</label>
    <textarea id="e-body" style="min-height:160px" placeholder="Write your email..."></textarea>
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
function setFilter(btn, f) { curFilter = f; document.querySelectorAll('#email-filters button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); load(); }

async function load() {
  var q = curFilter ? '?status='+curFilter : '';
  var emails = await fetch('/api/emails'+q).then(r=>r.json());
  if (!emails.length) { document.getElementById('email-list').innerHTML = '<div class="empty-msg">No emails found</div>'; return; }
  document.getElementById('email-list').innerHTML = '<table><thead><tr><th>Status</th><th>To</th><th>Subject</th><th>Scheduled</th><th>Actions</th></tr></thead><tbody>' +
    emails.map(e => '<tr><td><span class="badge '+e.status+'">'+e.status+'</span></td><td>'+esc(e.recipient_name||e.recipient_email)+'</td><td>'+esc(e.subject)+'</td><td>'+(e.scheduled_at?new Date(e.scheduled_at).toLocaleString():'—')+'</td><td><div class="todo-actions"><button onclick="openEditEmail('+e.id+')">&#9998;</button><button class="delete" onclick="deleteEmailDirect('+e.id+')">&#10005;</button></div></td></tr>'
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
  if (!confirm('Delete this email?')) return;
  await fetch('/api/emails/'+id, {method:'DELETE'});
  closeCompose(); load();
}

async function deleteEmailDirect(id) {
  if (!confirm('Delete this email?')) return;
  await fetch('/api/emails/'+id, {method:'DELETE'});
  load();
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

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
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
    <label>Content</label>
    <textarea id="n-content" style="min-height:200px" placeholder="Write your note..."></textarea>
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
    <div class="modal-actions">
      <button onclick="closeNote()">Cancel</button>
      <button class="primary" onclick="saveNote()">Save</button>
      <button class="danger" id="n-delete-btn" style="display:none" onclick="deleteNote()">Delete</button>
    </div>
  </div>
</div>

<script>
var colorMap = {warm:'var(--warm)',teal:'var(--teal)',green:'var(--green)',blue:'var(--blue)',default:'var(--border)'};

async function load() {
  var notes = await fetch('/api/notes').then(r=>r.json());
  if (!notes.length) { document.getElementById('notes-grid').innerHTML = '<div class="empty-msg" style="grid-column:1/-1">No notes yet. Create your first note!</div>'; return; }
  document.getElementById('notes-grid').innerHTML = notes.map(n => {
    var borderStyle = n.pinned ? 'border-color:'+(colorMap[n.color]||'var(--warm)') : (n.color!=='default'?'border-color:'+colorMap[n.color]:'');
    return '<div class="note-card'+(n.pinned?' pinned':'')+'" style="'+borderStyle+'" onclick="openEditNote('+n.id+')">'+
      (n.pinned?'<div style="font-size:10px;color:var(--warm);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">&#128204; Pinned</div>':'')+
      (n.title?'<div class="note-title">'+esc(n.title)+'</div>':'')+
      '<div class="note-preview">'+esc(n.content)+'</div>'+
      '<div class="note-date">'+new Date(n.updated_at).toLocaleDateString()+
      (n.reminder_at?' &bull; Reminder: '+new Date(n.reminder_at).toLocaleString():'')+
      '</div></div>';
  }).join('');
}

function openNote() {
  document.getElementById('note-modal-title').textContent = 'New Note';
  document.getElementById('n-id').value = '';
  document.getElementById('n-title').value = '';
  document.getElementById('n-content').value = '';
  document.getElementById('n-color').value = 'default';
  document.getElementById('n-reminder').value = '';
  document.getElementById('n-pinned').checked = false;
  document.getElementById('n-delete-btn').style.display = 'none';
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
  document.getElementById('n-delete-btn').style.display = 'inline-block';
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
  };
  if (!data.content) return alert('Content is required');
  var id = document.getElementById('n-id').value;
  if (id) await fetch('/api/notes/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  else await fetch('/api/notes', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  closeNote(); load();
}

async function deleteNote() {
  var id = document.getElementById('n-id').value;
  if (!confirm('Delete this note?')) return;
  await fetch('/api/notes/'+id, {method:'DELETE'});
  closeNote(); load();
}

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
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

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
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
    <h2>Email (SMTP)</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;" id="smtp-status"></p>
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

  ${AUTH_SECRET ? '<div class="section"><h2>Session</h2><div class="actions" style="margin-bottom:0;"><button class="danger" style="border-color:var(--red);color:var(--red);" onclick="logout()">Log Out</button></div></div>' : ''}
</div>

<script>
async function load() {
  var s = await fetch('/api/settings').then(r=>r.json());
  document.getElementById('s-theme').value = s.theme || 'dark';
  document.getElementById('s-timeout').value = s.session_timeout_minutes || 15;
  document.getElementById('s-horizon').value = s.default_horizon || 'short';
  document.getElementById('s-perfin').value = s.perfin_url || '';
  document.getElementById('smtp-status').textContent = s.smtp_configured
    ? 'SMTP is configured and ready to send emails.'
    : 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to enable email sending.';

  // Apply theme
  if (s.theme === 'light') document.documentElement.setAttribute('data-theme','light');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('theme', s.theme || 'dark');
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
  if (data.theme === 'light') document.documentElement.setAttribute('data-theme','light');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('theme', data.theme);

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

async function logout() {
  await fetch('/api/logout', {method:'POST'});
  location.href = '/login';
}

load();
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
    background_color: "#080b12",
    theme_color: "#080b12",
    icons: [
      { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
  });
});

app.get("/sw.js", (req, res) => {
  res.type("application/javascript").send(`
    const CACHE = 'per-sistant-v1';
    self.addEventListener('install', e => { self.skipWaiting(); });
    self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });
    self.addEventListener('fetch', e => { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); });
  `);
});

// SVG icon
const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#080b12"/>
  <text x="256" y="340" font-family="Inter,sans-serif" font-size="280" font-weight="300" fill="#d4a574" text-anchor="middle">P</text>
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
      "SELECT * FROM emails WHERE status = 'scheduled' AND scheduled_at <= now()"
    );
    for (const email of r.rows) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
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
const PORT = parseInt(process.env.PORT || "3001");

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Per-sistant running on http://localhost:${PORT}`);
    if (PERFIN_URL) console.log(`Linked to Perfin: ${PERFIN_URL}`);
    if (AUTH_SECRET) console.log(`Authentication: ${AUTH_MODE} mode`);
    if (process.env.SMTP_HOST) console.log("SMTP configured for email sending");
  });
}

start().catch(console.error);

module.exports = { app, pool, processScheduledEmails, parseTimeExpr: null };
