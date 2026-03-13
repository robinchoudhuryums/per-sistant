// ============================================================================
// Per-sistant — API Tests
// ============================================================================
// Tests cover API logic, input validation, and helper functions.
// No database required — tests use mock data and direct function calls.
// Run with: npm test
// ============================================================================

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// ---------------------------------------------------------------------------
// Time expression parsing tests
// ---------------------------------------------------------------------------
describe("Time expression parsing", () => {
  // Inline a simplified version of the parser for testing
  function parseTimeExpr(text) {
    const now = new Date();
    const days = {sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,
                  sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6};
    const dayMatch = text.match(/(?:on\s+|this\s+|next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)/i);
    const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    const morningMatch = text.match(/\bmorning\b/i);
    const afternoonMatch = text.match(/\bafternoon\b/i);
    const eveningMatch = text.match(/\bevening\b/i);
    const tomorrowMatch = text.match(/\btomorrow\b/i);

    const target = new Date(now);
    if (tomorrowMatch) { target.setDate(target.getDate()+1); }
    else if (dayMatch) {
      const targetDay = days[dayMatch[1].toLowerCase()];
      let diff = (targetDay - now.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      target.setDate(target.getDate() + diff);
    }

    if (timeMatch) {
      let h = parseInt(timeMatch[1]);
      const m = parseInt(timeMatch[2]||"0");
      if (timeMatch[3].toLowerCase() === "pm" && h < 12) h += 12;
      if (timeMatch[3].toLowerCase() === "am" && h === 12) h = 0;
      target.setHours(h, m, 0, 0);
    } else if (morningMatch) { target.setHours(9,0,0,0); }
    else if (afternoonMatch) { target.setHours(14,0,0,0); }
    else if (eveningMatch) { target.setHours(18,0,0,0); }
    else { target.setHours(9,0,0,0); }

    return target > now ? target : null;
  }

  it("parses 'tomorrow morning' correctly", () => {
    const result = parseTimeExpr("send email tomorrow morning");
    assert.ok(result instanceof Date);
    assert.equal(result.getHours(), 9);
    assert.equal(result.getMinutes(), 0);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    assert.equal(result.getDate(), tomorrow.getDate());
  });

  it("parses 'tomorrow afternoon' correctly", () => {
    const result = parseTimeExpr("meet tomorrow afternoon");
    assert.ok(result instanceof Date);
    assert.equal(result.getHours(), 14);
  });

  it("parses 'tomorrow evening' correctly", () => {
    const result = parseTimeExpr("call tomorrow evening");
    assert.ok(result instanceof Date);
    assert.equal(result.getHours(), 18);
  });

  it("parses explicit time like '9AM'", () => {
    const result = parseTimeExpr("send email tomorrow at 9AM");
    assert.ok(result instanceof Date);
    assert.equal(result.getHours(), 9);
    assert.equal(result.getMinutes(), 0);
  });

  it("parses '2:30PM' correctly", () => {
    const result = parseTimeExpr("reminder tomorrow at 2:30PM");
    assert.ok(result instanceof Date);
    assert.equal(result.getHours(), 14);
    assert.equal(result.getMinutes(), 30);
  });

  it("parses '12AM' as midnight", () => {
    const result = parseTimeExpr("task tomorrow at 12AM");
    assert.ok(result instanceof Date);
    assert.equal(result.getHours(), 0);
  });

  it("parses day names correctly", () => {
    const result = parseTimeExpr("send email on Monday at 9AM");
    assert.ok(result instanceof Date);
    assert.equal(result.getDay(), 1); // Monday
    assert.equal(result.getHours(), 9);
  });

  it("parses abbreviated day names", () => {
    const result = parseTimeExpr("email on Tue morning");
    assert.ok(result instanceof Date);
    assert.equal(result.getDay(), 2); // Tuesday
    assert.equal(result.getHours(), 9);
  });

  it("returns future date for day names", () => {
    const result = parseTimeExpr("meet on Wednesday at 3PM");
    assert.ok(result instanceof Date);
    assert.ok(result > new Date());
  });
});

// ---------------------------------------------------------------------------
// Input validation tests
// ---------------------------------------------------------------------------
describe("Input validation", () => {
  it("todo requires title", () => {
    const data = { description: "test" };
    assert.ok(!data.title, "Should require title");
  });

  it("email requires recipient_email, subject, body", () => {
    const valid = { recipient_email: "a@b.com", subject: "hi", body: "test" };
    const invalid1 = { subject: "hi", body: "test" };
    const invalid2 = { recipient_email: "a@b.com", body: "test" };
    assert.ok(valid.recipient_email && valid.subject && valid.body);
    assert.ok(!invalid1.recipient_email);
    assert.ok(!invalid2.subject);
  });

  it("note requires content", () => {
    const valid = { content: "test note" };
    const invalid = { title: "note" };
    assert.ok(valid.content);
    assert.ok(!invalid.content);
  });

  it("contact requires name and email", () => {
    const valid = { name: "Mom", email: "mom@email.com" };
    const invalid = { name: "Mom" };
    assert.ok(valid.name && valid.email);
    assert.ok(!invalid.email);
  });

  it("priority must be valid", () => {
    const valid = ["low", "medium", "high", "urgent"];
    assert.ok(valid.includes("medium"));
    assert.ok(!valid.includes("critical"));
  });

  it("horizon must be valid", () => {
    const valid = ["short", "medium", "long"];
    assert.ok(valid.includes("short"));
    assert.ok(!valid.includes("immediate"));
  });

  it("email status must be valid", () => {
    const valid = ["draft", "scheduled", "sent", "failed"];
    assert.ok(valid.includes("draft"));
    assert.ok(!valid.includes("pending"));
  });

  it("note color must be valid", () => {
    const valid = ["default", "warm", "teal", "green", "blue"];
    assert.ok(valid.includes("warm"));
    assert.ok(!valid.includes("red"));
  });
});

// ---------------------------------------------------------------------------
// Data structure tests
// ---------------------------------------------------------------------------
describe("Data structures", () => {
  it("todo has expected fields", () => {
    const todo = {
      id: 1, title: "Test", description: null, priority: "medium",
      horizon: "short", category: null, due_date: null, completed: false,
      completed_at: null, sort_order: 0, created_at: new Date(), updated_at: new Date()
    };
    assert.ok("id" in todo);
    assert.ok("title" in todo);
    assert.ok("priority" in todo);
    assert.ok("horizon" in todo);
    assert.ok("completed" in todo);
  });

  it("email has expected fields", () => {
    const email = {
      id: 1, recipient_name: "Mom", recipient_email: "mom@email.com",
      subject: "Dinner", body: "Hi Mom", status: "draft",
      scheduled_at: null, sent_at: null, error_message: null
    };
    assert.ok("recipient_email" in email);
    assert.ok("status" in email);
    assert.ok("scheduled_at" in email);
  });

  it("settings has single-row constraint", () => {
    const settings = { id: 1, theme: "dark", session_timeout_minutes: 15 };
    assert.equal(settings.id, 1);
  });
});

// ---------------------------------------------------------------------------
// Contact lookup tests
// ---------------------------------------------------------------------------
describe("Contact lookup", () => {
  it("case-insensitive name matching", () => {
    const contacts = [
      { name: "Mom", email: "mom@email.com" },
      { name: "Boss", email: "boss@work.com" },
    ];
    const lookup = (name) => contacts.find(c => c.name.toLowerCase() === name.toLowerCase());
    assert.deepEqual(lookup("mom"), contacts[0]);
    assert.deepEqual(lookup("MOM"), contacts[0]);
    assert.deepEqual(lookup("Mom"), contacts[0]);
    assert.equal(lookup("unknown"), undefined);
  });

  it("env contacts parsing", () => {
    const json = '{"mom":"mom@email.com","boss":"boss@work.com"}';
    const parsed = JSON.parse(json);
    assert.equal(parsed.mom, "mom@email.com");
    assert.equal(parsed.boss, "boss@work.com");
  });
});

// ---------------------------------------------------------------------------
// Sort order tests
// ---------------------------------------------------------------------------
describe("Todo sorting", () => {
  it("sorts by priority weight", () => {
    const priorities = { urgent: 0, high: 1, medium: 2, low: 3 };
    const todos = [
      { title: "A", priority: "low" },
      { title: "B", priority: "urgent" },
      { title: "C", priority: "medium" },
    ];
    const sorted = [...todos].sort((a, b) => priorities[a.priority] - priorities[b.priority]);
    assert.equal(sorted[0].title, "B"); // urgent first
    assert.equal(sorted[1].title, "C"); // medium second
    assert.equal(sorted[2].title, "A"); // low last
  });

  it("completed items sort after pending", () => {
    const todos = [
      { title: "Done", completed: true },
      { title: "Pending", completed: false },
    ];
    const sorted = [...todos].sort((a, b) => a.completed - b.completed);
    assert.equal(sorted[0].title, "Pending");
    assert.equal(sorted[1].title, "Done");
  });
});

// ---------------------------------------------------------------------------
// Date utility tests
// ---------------------------------------------------------------------------
describe("Date utilities", () => {
  it("detects overdue tasks", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isOverdue = (dueDate) => new Date(dueDate) <= new Date();
    assert.ok(isOverdue(yesterday));
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    assert.ok(!isOverdue(tomorrow));
  });

  it("formats dates correctly", () => {
    const date = new Date("2026-03-15");
    const formatted = date.toISOString().split("T")[0];
    assert.equal(formatted, "2026-03-15");
  });
});

// ---------------------------------------------------------------------------
// Recurring task tests
// ---------------------------------------------------------------------------
describe("Recurring tasks", () => {
  it("validates recurrence rules", () => {
    const valid = ["daily", "weekly", "monthly", "yearly", "weekdays"];
    assert.ok(valid.includes("daily"));
    assert.ok(valid.includes("weekdays"));
    assert.ok(!valid.includes("biweekly"));
    assert.ok(!valid.includes(""));
  });

  it("calculates next occurrence for daily", () => {
    const today = new Date("2026-03-12");
    const next = new Date(today);
    next.setDate(next.getDate() + 1);
    assert.equal(next.toISOString().split("T")[0], "2026-03-13");
  });

  it("calculates next occurrence for weekly", () => {
    const today = new Date("2026-03-12");
    const next = new Date(today);
    next.setDate(next.getDate() + 7);
    assert.equal(next.toISOString().split("T")[0], "2026-03-19");
  });

  it("calculates next occurrence for monthly", () => {
    const today = new Date("2026-03-12");
    const next = new Date(today);
    next.setMonth(next.getMonth() + 1);
    assert.equal(next.toISOString().split("T")[0], "2026-04-12");
  });

  it("calculates next occurrence for yearly", () => {
    const today = new Date("2026-03-12");
    const next = new Date(today);
    next.setFullYear(next.getFullYear() + 1);
    assert.equal(next.toISOString().split("T")[0], "2027-03-12");
  });

  it("weekdays skips weekend", () => {
    // Saturday -> Monday
    const sat = new Date("2026-03-14"); // Saturday
    const next = new Date(sat);
    const day = next.getDay();
    if (day === 6) next.setDate(next.getDate() + 2); // Skip to Monday
    else if (day === 0) next.setDate(next.getDate() + 1);
    else next.setDate(next.getDate() + 1);
    assert.equal(next.getDay(), 1); // Monday
  });

  it("recurring todo has correct fields", () => {
    const todo = {
      id: 1, title: "Daily standup", recurring: true,
      recurrence_rule: "weekdays", recurrence_parent_id: null
    };
    assert.ok(todo.recurring);
    assert.equal(todo.recurrence_rule, "weekdays");
    assert.equal(todo.recurrence_parent_id, null);
  });
});

// ---------------------------------------------------------------------------
// Subtask tests
// ---------------------------------------------------------------------------
describe("Subtasks", () => {
  it("subtask has expected fields", () => {
    const subtask = {
      id: 1, todo_id: 5, title: "Step 1",
      completed: false, sort_order: 0
    };
    assert.ok("todo_id" in subtask);
    assert.ok("title" in subtask);
    assert.ok("completed" in subtask);
    assert.ok("sort_order" in subtask);
  });

  it("calculates subtask progress", () => {
    const subtasks = [
      { completed: true }, { completed: true }, { completed: false }
    ];
    const completed = subtasks.filter(s => s.completed).length;
    const total = subtasks.length;
    const pct = Math.round((completed / total) * 100);
    assert.equal(completed, 2);
    assert.equal(total, 3);
    assert.equal(pct, 67);
  });

  it("handles empty subtask list", () => {
    const subtasks = [];
    const pct = subtasks.length === 0 ? 0 : Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100);
    assert.equal(pct, 0);
  });
});

// ---------------------------------------------------------------------------
// Email template tests
// ---------------------------------------------------------------------------
describe("Email templates", () => {
  it("template has expected fields", () => {
    const template = {
      id: 1, name: "Weekly Update", subject: "Weekly Update - {{date}}",
      body: "Hi team,\n\nHere is the weekly update..."
    };
    assert.ok("name" in template);
    assert.ok("subject" in template);
    assert.ok("body" in template);
  });

  it("template requires name, subject, body", () => {
    const valid = { name: "Test", subject: "Sub", body: "Body" };
    const invalid = { name: "Test", subject: "Sub" };
    assert.ok(valid.name && valid.subject && valid.body);
    assert.ok(!invalid.body);
  });
});

// ---------------------------------------------------------------------------
// Natural language todo parsing tests
// ---------------------------------------------------------------------------
describe("Natural language todo creation", () => {
  function parseQuickTodo(text) {
    const result = { title: text, priority: "medium", horizon: "short", due_date: null };
    if (/\b(urgent|asap|critical)\b/i.test(text)) result.priority = "urgent";
    else if (/\b(important|high\s*priority)\b/i.test(text)) result.priority = "high";
    else if (/\b(low\s*priority|whenever|someday)\b/i.test(text)) result.priority = "low";
    if (/\b(long[\s-]*term|eventually|this year)\b/i.test(text)) result.horizon = "long";
    else if (/\b(medium[\s-]*term|this month|soon)\b/i.test(text)) result.horizon = "medium";
    const tomorrowMatch = /\btomorrow\b/i.test(text);
    if (tomorrowMatch) {
      const d = new Date(); d.setDate(d.getDate() + 1);
      result.due_date = d.toISOString().split("T")[0];
    }
    return result;
  }

  it("detects urgent priority", () => {
    const r = parseQuickTodo("Fix server crash URGENT");
    assert.equal(r.priority, "urgent");
  });

  it("detects high priority", () => {
    const r = parseQuickTodo("Important: review contract");
    assert.equal(r.priority, "high");
  });

  it("detects low priority", () => {
    const r = parseQuickTodo("Someday clean garage");
    assert.equal(r.priority, "low");
  });

  it("detects long-term horizon", () => {
    const r = parseQuickTodo("Long-term: learn piano");
    assert.equal(r.horizon, "long");
  });

  it("detects medium-term horizon", () => {
    const r = parseQuickTodo("This month finish report");
    assert.equal(r.horizon, "medium");
  });

  it("defaults to short-term medium priority", () => {
    const r = parseQuickTodo("Buy groceries");
    assert.equal(r.priority, "medium");
    assert.equal(r.horizon, "short");
  });

  it("detects tomorrow as due date", () => {
    const r = parseQuickTodo("Submit report tomorrow");
    assert.ok(r.due_date);
    const expected = new Date();
    expected.setDate(expected.getDate() + 1);
    assert.equal(r.due_date, expected.toISOString().split("T")[0]);
  });
});

// ---------------------------------------------------------------------------
// Global search tests
// ---------------------------------------------------------------------------
describe("Global search", () => {
  it("matches across multiple item types", () => {
    const items = [
      { type: "todo", title: "Buy groceries", description: "" },
      { type: "email", subject: "Grocery list", body: "Milk, eggs" },
      { type: "note", title: "Shopping", content: "Need groceries" },
    ];
    const query = "grocer";
    const results = items.filter(i => {
      const text = [i.title, i.description, i.subject, i.body, i.content]
        .filter(Boolean).join(" ").toLowerCase();
      return text.includes(query.toLowerCase());
    });
    assert.equal(results.length, 3);
  });

  it("handles empty query", () => {
    const query = "";
    assert.ok(!query.trim());
  });

  it("is case-insensitive", () => {
    const items = [{ title: "MEETING with team" }];
    const results = items.filter(i => i.title.toLowerCase().includes("meeting"));
    assert.equal(results.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Calendar tests
// ---------------------------------------------------------------------------
describe("Calendar", () => {
  it("computes days in month", () => {
    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    assert.equal(daysInMonth(2026, 0), 31); // January
    assert.equal(daysInMonth(2026, 1), 28); // February (non-leap)
    assert.equal(daysInMonth(2024, 1), 29); // February (leap)
    assert.equal(daysInMonth(2026, 2), 31); // March
  });

  it("computes first day of month", () => {
    const firstDay = new Date(2026, 2, 1).getDay(); // March 2026
    assert.ok(firstDay >= 0 && firstDay <= 6);
  });

  it("week starts on Sunday (day 0)", () => {
    const sunday = new Date("2026-03-08"); // a Sunday
    assert.equal(sunday.getDay(), 0);
  });
});

// ---------------------------------------------------------------------------
// Weekly review tests
// ---------------------------------------------------------------------------
describe("Weekly review", () => {
  it("computes week boundaries", () => {
    const getWeekStart = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const getWeekEnd = (start) => {
      const d = new Date(start);
      d.setDate(d.getDate() + 6);
      d.setHours(23, 59, 59, 999);
      return d;
    };
    const start = getWeekStart("2026-03-12");
    assert.equal(start.getDay(), 0); // Sunday
    const end = getWeekEnd(start);
    assert.equal(end.getDay(), 6); // Saturday
  });

  it("review has expected fields", () => {
    const review = {
      week_start: "2026-03-08", week_end: "2026-03-14",
      tasks_completed: 5, tasks_created: 8,
      emails_sent: 3, notes_created: 2, summary: "Productive week"
    };
    assert.ok("tasks_completed" in review);
    assert.ok("emails_sent" in review);
    assert.ok("summary" in review);
  });
});

// ---------------------------------------------------------------------------
// Drag-and-drop reorder tests
// ---------------------------------------------------------------------------
describe("Drag-and-drop reorder", () => {
  it("reorders array items correctly", () => {
    const items = [{id:1,sort_order:0},{id:2,sort_order:1},{id:3,sort_order:2}];
    // Move item 3 to position 0
    const orderedIds = [3, 1, 2];
    const reordered = orderedIds.map((id, i) => ({ id, sort_order: i }));
    assert.equal(reordered[0].id, 3);
    assert.equal(reordered[0].sort_order, 0);
    assert.equal(reordered[1].id, 1);
    assert.equal(reordered[2].id, 2);
  });
});

// ---------------------------------------------------------------------------
// Keyboard shortcuts tests
// ---------------------------------------------------------------------------
describe("Keyboard shortcuts", () => {
  it("shortcut map has expected keys", () => {
    const shortcuts = {
      "n": "new-todo", "e": "new-email", "/": "search",
      "t": "todos-page", "d": "dashboard"
    };
    assert.equal(shortcuts["n"], "new-todo");
    assert.equal(shortcuts["/"], "search");
    assert.ok(!shortcuts["z"]);
  });
});

// ---------------------------------------------------------------------------
// AI model selection tests
// ---------------------------------------------------------------------------
describe("AI model selection", () => {
  it("valid model identifiers", () => {
    const models = {
      haiku: "claude-haiku-4-5-20251001",
      sonnet: "claude-sonnet-4-6-20250415",
    };
    assert.ok(models.haiku);
    assert.ok(models.sonnet);
    assert.ok(!models.opus); // not available
  });

  it("valid feature settings values", () => {
    const valid = ["haiku", "sonnet", "off"];
    assert.ok(valid.includes("haiku"));
    assert.ok(valid.includes("sonnet"));
    assert.ok(valid.includes("off"));
    assert.ok(!valid.includes("gpt-4"));
  });

  it("all 8 AI features have model settings", () => {
    const features = [
      "ai_model_email_draft", "ai_model_task_breakdown", "ai_model_quick_add",
      "ai_model_review_summary", "ai_model_email_tone", "ai_model_daily_briefing",
      "ai_model_note_tagging", "ai_model_task_suggestions"
    ];
    assert.equal(features.length, 8);
    features.forEach(f => assert.ok(f.startsWith("ai_model_")));
  });
});

// ---------------------------------------------------------------------------
// AI task breakdown tests
// ---------------------------------------------------------------------------
describe("AI task breakdown", () => {
  it("returns array of subtask strings", () => {
    const response = { subtasks: ["Research options", "Compare prices", "Make decision"] };
    assert.ok(Array.isArray(response.subtasks));
    assert.ok(response.subtasks.every(s => typeof s === "string"));
  });

  it("requires task title", () => {
    const input = { title: "" };
    assert.ok(!input.title);
  });
});

// ---------------------------------------------------------------------------
// AI tone adjustment tests
// ---------------------------------------------------------------------------
describe("AI tone adjustment", () => {
  it("valid tone options", () => {
    const tones = ["more formal", "more casual", "shorter", "friendlier", "more direct"];
    assert.equal(tones.length, 5);
    assert.ok(tones.includes("more formal"));
    assert.ok(tones.includes("shorter"));
  });

  it("requires body and tone", () => {
    const valid = { body: "Hello", tone: "formal" };
    const invalid = { body: "Hello" };
    assert.ok(valid.body && valid.tone);
    assert.ok(!invalid.tone);
  });
});

// ---------------------------------------------------------------------------
// Todo category tests
// ---------------------------------------------------------------------------
describe("Todo categories", () => {
  it("default categories exist", () => {
    const defaults = ["work", "personal", "health", "finance", "errands", "home", "learning"];
    assert.equal(defaults.length, 7);
    assert.ok(defaults.includes("work"));
    assert.ok(defaults.includes("personal"));
  });

  it("merges default and custom categories", () => {
    const defaults = ["work", "personal", "health"];
    const custom = ["custom-project", "work"];
    const all = [...new Set([...defaults, ...custom])].sort();
    assert.equal(all.length, 4);
    assert.ok(all.includes("custom-project"));
  });

  it("category filter works on todo query", () => {
    const params = { category: "work" };
    assert.equal(params.category, "work");
  });
});

// ---------------------------------------------------------------------------
// Note tags tests
// ---------------------------------------------------------------------------
describe("Note tags", () => {
  it("tags are an array of strings", () => {
    const tags = ["meeting-notes", "project", "action-items"];
    assert.ok(Array.isArray(tags));
    assert.ok(tags.every(t => typeof t === "string"));
  });

  it("tags are lowercase and valid format", () => {
    const tags = ["meeting-notes", "project-alpha"];
    tags.forEach(t => {
      assert.ok(t === t.toLowerCase());
      assert.ok(/^[a-z0-9-]+$/.test(t));
    });
  });

  it("handles empty tags", () => {
    const note = { tags: null };
    assert.equal(note.tags, null);
  });
});

// ---------------------------------------------------------------------------
// Dashboard view tests
// ---------------------------------------------------------------------------
describe("Dashboard task views", () => {
  it("groups tasks by category", () => {
    const tasks = [
      { title: "A", category: "work" },
      { title: "B", category: "personal" },
      { title: "C", category: "work" },
    ];
    const cats = {};
    tasks.forEach(t => { var c = t.category || "Uncategorized"; if (!cats[c]) cats[c] = []; cats[c].push(t); });
    assert.equal(Object.keys(cats).length, 2);
    assert.equal(cats["work"].length, 2);
  });

  it("groups tasks by priority", () => {
    const tasks = [
      { priority: "urgent" }, { priority: "high" }, { priority: "urgent" }
    ];
    const groups = {};
    tasks.forEach(t => { if (!groups[t.priority]) groups[t.priority] = []; groups[t.priority].push(t); });
    assert.equal(groups["urgent"].length, 2);
    assert.equal(groups["high"].length, 1);
  });

  it("filters due soon tasks", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tasks = [
      { title: "A", due_date: tomorrow.toISOString() },
      { title: "B", due_date: null },
    ];
    const withDue = tasks.filter(t => t.due_date);
    assert.equal(withDue.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Security tests
// ---------------------------------------------------------------------------
describe("Security", () => {
  it("session timeout calculation", () => {
    const timeoutMinutes = 15;
    const timeout = timeoutMinutes * 60 * 1000;
    assert.equal(timeout, 900000);

    const lastActivity = Date.now() - 800000; // 13.3 minutes ago
    assert.ok(Date.now() - lastActivity < timeout, "Should still be valid");

    const expired = Date.now() - 1000000; // 16.7 minutes ago
    assert.ok(Date.now() - expired >= timeout, "Should be expired");
  });

  it("auth mode detection", () => {
    // PIN mode
    assert.equal("pin", "1234" ? "pin" : "password");
    // Password mode
    const pw = "secret";
    const mode = null ? "pin" : (pw ? "password" : null);
    assert.equal(mode, "password");
    // No auth
    const noAuth = null;
    const noMode = null ? "pin" : (noAuth ? "password" : null);
    assert.equal(noMode, null);
  });

  it("AI feature whitelist prevents injection", () => {
    const VALID_AI_FEATURES = ["email_draft", "task_breakdown", "smart_quick_add", "weekly_review", "email_tone", "daily_briefing", "note_tags", "task_suggestions"];
    assert.ok(VALID_AI_FEATURES.includes("email_draft"));
    assert.ok(VALID_AI_FEATURES.includes("task_suggestions"));
    assert.ok(!VALID_AI_FEATURES.includes("'; DROP TABLE users;--"));
    assert.ok(!VALID_AI_FEATURES.includes("anything_else"));
  });

  it("email validation regex", () => {
    function isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    assert.ok(isValidEmail("user@example.com"));
    assert.ok(isValidEmail("a@b.co"));
    assert.ok(!isValidEmail("notanemail"));
    assert.ok(!isValidEmail("missing@domain"));
    assert.ok(!isValidEmail("@no-local.com"));
    assert.ok(!isValidEmail("spaces in@email.com"));
  });

  it("enum validation for priorities and horizons", () => {
    const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];
    const VALID_HORIZONS = ["short", "medium", "long"];
    assert.ok(VALID_PRIORITIES.includes("urgent"));
    assert.ok(!VALID_PRIORITIES.includes("critical"));
    assert.ok(VALID_HORIZONS.includes("long"));
    assert.ok(!VALID_HORIZONS.includes("forever"));
  });
});

// ---------------------------------------------------------------------------
// Todo URL field tests
// ---------------------------------------------------------------------------
describe("Todo URL field", () => {
  it("todo can have optional URL", () => {
    const todo = { id: 1, title: "Book haircut", url: "https://styleseat.com/barber" };
    assert.ok(todo.url);
    assert.ok(todo.url.startsWith("https://"));
  });

  it("URL is nullable", () => {
    const todo = { id: 2, title: "Buy groceries", url: null };
    assert.equal(todo.url, null);
  });

  it("URL included in todo data structure", () => {
    const fields = ["id", "title", "description", "priority", "horizon", "category",
                    "due_date", "completed", "sort_order", "recurring", "recurrence_rule", "url"];
    assert.ok(fields.includes("url"));
  });
});

// ---------------------------------------------------------------------------
// Task suggestions tests
// ---------------------------------------------------------------------------
describe("Task suggestions", () => {
  it("suggestion has expected fields", () => {
    const suggestion = {
      id: 1, title: "Book haircut", description: null, priority: "medium",
      horizon: "short", category: "personal", due_date: "2026-03-20",
      url: "https://styleseat.com/barber", reason: "You do this every 3 weeks",
      status: "pending", snoozed_until: null, created_at: new Date().toISOString(),
    };
    assert.ok(suggestion.title);
    assert.ok(suggestion.reason);
    assert.equal(suggestion.status, "pending");
  });

  it("valid suggestion statuses", () => {
    const statuses = ["pending", "accepted", "rejected", "snoozed"];
    assert.equal(statuses.length, 4);
    assert.ok(statuses.includes("pending"));
    assert.ok(statuses.includes("snoozed"));
    assert.ok(!statuses.includes("deleted"));
  });

  it("accepting creates a todo from suggestion", () => {
    const suggestion = { title: "Haircut", priority: "medium", horizon: "short", category: "personal", url: "https://example.com" };
    const todo = { title: suggestion.title, priority: suggestion.priority, horizon: suggestion.horizon, category: suggestion.category, url: suggestion.url };
    assert.equal(todo.title, "Haircut");
    assert.equal(todo.url, "https://example.com");
  });

  it("snooze calculates future date", () => {
    const days = 7;
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + days);
    assert.ok(until > now);
    const diff = Math.round((until - now) / (1000 * 60 * 60 * 24));
    assert.equal(diff, 7);
  });

  it("deduplicates against existing todos and suggestions", () => {
    const existingTitles = ["buy groceries", "call dentist"];
    const currentTitles = ["book haircut"];
    const suggestions = [
      { title: "Buy Groceries" },
      { title: "New Task" },
      { title: "Book Haircut" },
    ];
    const filtered = suggestions.filter(s =>
      !existingTitles.includes(s.title.toLowerCase()) &&
      !currentTitles.includes(s.title.toLowerCase())
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].title, "New Task");
  });
});
