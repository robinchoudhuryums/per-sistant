-- ============================================================================
-- Per-sistant — Task Suggestions & Booking URLs Migration
-- ============================================================================
-- Adds: optional URL on todos, task_suggestions table, AI model preference
-- ============================================================================

-- Optional URL field on todos (for booking links, reference links, etc.)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS url TEXT;

-- Smart task suggestions (AI-generated from completed task history)
CREATE TABLE IF NOT EXISTS task_suggestions (
    id              SERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    description     TEXT,
    priority        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    horizon         TEXT NOT NULL DEFAULT 'short'
                    CHECK (horizon IN ('short', 'medium', 'long')),
    category        TEXT,
    due_date        DATE,
    url             TEXT,
    reason          TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'rejected', 'snoozed')),
    snoozed_until   DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI model preference for task suggestions
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ai_model_task_suggestions TEXT NOT NULL DEFAULT 'off';
