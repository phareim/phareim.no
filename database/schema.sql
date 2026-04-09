-- Gallery characters (for the character gallery feature)
CREATE TABLE IF NOT EXISTS gallery_characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT, class TEXT, background TEXT, physical_description TEXT,
  stats TEXT DEFAULT '{}',
  abilities TEXT DEFAULT '[]',
  image_url TEXT,
  video_urls TEXT DEFAULT '{}',
  level INTEGER DEFAULT 1,
  hit_points TEXT DEFAULT '{}',
  armor_class INTEGER,
  location TEXT DEFAULT '{}',
  enabled INTEGER DEFAULT 1,
  generation_data TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Emoji to image prompt mappings
CREATE TABLE IF NOT EXISTS emoji_prompts (
  emoji TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default image prompt templates
CREATE TABLE IF NOT EXISTS image_prompts (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Per-user custom prompt lists (flat, user_id = 'owner' for admin)
CREATE TABLE IF NOT EXISTS user_prompts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT DEFAULT 'custom',
  copied_from TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_prompts_user_id ON user_prompts(user_id, created_at DESC);

-- Guestbook entries
CREATE TABLE IF NOT EXISTS guestbook_entries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  ip_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_guestbook_created_at ON guestbook_entries(created_at DESC);

-- AI model definitions for image generation
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
