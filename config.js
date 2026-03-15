// ============================================================================
// Per-sistant — Configuration & Constants
// ============================================================================

const crypto = require("crypto");

// Auth
const SESSION_PASSWORD = process.env.SESSION_PASSWORD;
const SESSION_PIN = process.env.SESSION_PIN;
const AUTH_SECRET = SESSION_PASSWORD || SESSION_PIN || null;
const AUTH_MODE = SESSION_PIN ? "pin" : (SESSION_PASSWORD ? "password" : null);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.SESSION_SECRET) {
  console.warn("WARNING: SESSION_SECRET not set — using random secret. Sessions will be invalidated on every restart.");
}
const PERFIN_URL = process.env.PERFIN_URL || null;

// Contacts from env
let envContacts = {};
try { envContacts = JSON.parse(process.env.CONTACTS || "{}"); } catch { envContacts = {}; }

// Validation constants
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];
const VALID_HORIZONS = ["short", "medium", "long"];
const VALID_RECURRENCE_RULES = ["daily", "weekly", "monthly", "yearly", "weekdays", "custom_days", "custom_weeks", "custom_months"];
const VALID_NOTE_COLORS = ["default", "warm", "teal", "green", "blue"];
const VALID_EMAIL_STATUSES = ["draft", "scheduled", "sent", "failed"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_AI_FEATURES = ["email_draft", "task_breakdown", "quick_add", "review_summary", "email_tone", "daily_briefing", "note_tagging", "smart_suggestions", "natural_language_query"];
const VALID_WEBHOOK_EVENTS = ["todo_created", "todo_completed", "email_sent", "note_created", "reminder_due", "streak_milestone"];
const VALID_TRIGGERS = ["todo_created", "todo_completed", "email_created", "note_created", "schedule"];
const VALID_ACTIONS = ["set_priority", "set_category", "set_horizon", "add_tag", "send_notification", "create_todo"];

module.exports = {
  SESSION_PASSWORD, SESSION_PIN, AUTH_SECRET, AUTH_MODE, SESSION_SECRET, PERFIN_URL,
  envContacts,
  VALID_PRIORITIES, VALID_HORIZONS, VALID_RECURRENCE_RULES,
  VALID_NOTE_COLORS, VALID_EMAIL_STATUSES, EMAIL_REGEX,
  VALID_AI_FEATURES, VALID_WEBHOOK_EVENTS,
  VALID_TRIGGERS, VALID_ACTIONS,
};
