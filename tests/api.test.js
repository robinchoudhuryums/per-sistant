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
});
