-- Game state per player
CREATE TABLE IF NOT EXISTS game_states (
  user_id TEXT PRIMARY KEY,
  coordinates_north INTEGER DEFAULT 0,
  coordinates_west INTEGER DEFAULT 0,
  inventory TEXT DEFAULT '[]',         -- JSON array of item name strings
  visited TEXT DEFAULT '[]',           -- JSON array of "north,west" strings
  messages TEXT DEFAULT '[]',          -- JSON array of ChatCompletionMessageParam
  current_place_name TEXT,
  current_place_description TEXT,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- World locations
CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,                 -- "north,west" format
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  coordinates_north INTEGER NOT NULL,
  coordinates_west INTEGER NOT NULL,
  modifications TEXT DEFAULT '[]',     -- JSON array of { text, timestamp }
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Items in the world
CREATE TABLE IF NOT EXISTS items (
  name TEXT PRIMARY KEY,               -- Item name is the unique ID
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  properties TEXT DEFAULT '{}',        -- JSON: { damage?, defense?, healing?, uses?, value? }
  location_north INTEGER,
  location_west INTEGER,
  is_picked_up INTEGER DEFAULT 0,
  is_legacy INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Gallery characters (for the character gallery feature, separate from RPG NPCs)
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

-- RPG Characters/NPCs (separate from gallery characters)
CREATE TABLE IF NOT EXISTS characters (
  name TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  personality TEXT,
  location_north INTEGER,
  location_west INTEGER,
  has_left INTEGER DEFAULT 0,
  -- Runtime / relationship state
  conversation_history TEXT DEFAULT '[]',   -- JSON array of ChatCompletionMessageParam
  relationship_level INTEGER DEFAULT 0,
  mood TEXT DEFAULT 'neutral',
  quests_given TEXT DEFAULT '[]',
  items_traded TEXT DEFAULT '[]',
  first_met_at DATETIME,
  last_interaction_at DATETIME,
  times_spoken_to INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
