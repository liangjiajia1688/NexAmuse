-- NexAmuse forum tables + seed sections
-- Run once: npx wrangler d1 execute nexamuse-db --remote --file=src/migrations/004_forum.sql

CREATE TABLE IF NOT EXISTS forum_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '💬',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS forum_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  user_level TEXT DEFAULT 'Standard',
  views INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS forum_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_threads_section ON forum_threads(section_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_recent ON forum_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replies_thread ON forum_replies(thread_id, created_at ASC);

-- Seed the official forum sections (frontend select mirrors these slugs)
INSERT OR IGNORE INTO forum_sections (name, slug, description, icon, sort_order) VALUES
('Venue Design & Planning', 'venue-design', 'FEC layout, theme concepts, capacity planning and construction tips', '🏗️', 1),
('Equipment Reviews & Recommendations', 'equipment-reviews', 'Honest reviews, comparisons and buying advice from operators', '🎮', 2),
('Business & Revenue Strategy', 'business-strategy', 'Pricing, marketing, membership programs, F&B integration', '📊', 3),
('Exhibition Reports & Networking', 'exhibitions', 'Show reports, networking tips and event experiences', '🎪', 4),
('Technical Support & Maintenance', 'technical', 'Ride maintenance, software updates and troubleshooting', '🔧', 5),
('Buy / Sell / Trade Equipment', 'buy-sell', 'Second-hand machines, surplus stock and trade offers — VIP members only to post', '🛒', 6),
('Amusement Park Operations', 'park-operations', 'Theme parks, fairgrounds, outdoor attractions and park management', '🎡', 7);
