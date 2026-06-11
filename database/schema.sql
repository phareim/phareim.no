-- AI model definitions for image generation
-- (CI runs this idempotently on deploy; older tables from removed features
-- still exist in the live D1 with their data — see git history for their DDL)
CREATE TABLE IF NOT EXISTS model_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  endpoint TEXT,
  type TEXT,
  base_prompt TEXT,
  prompt_suffix TEXT,
  parameters TEXT DEFAULT '{}',
  supported_styles TEXT DEFAULT '[]',
  priority INTEGER DEFAULT 999,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
