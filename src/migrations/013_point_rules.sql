-- NexAmuse D1 migration: configurable points earning rules
-- Run once:  npx wrangler d1 execute nexamuse-db --remote --file=src/migrations/013_point_rules.sql

CREATE TABLE IF NOT EXISTS point_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  frequency TEXT,
  min_level TEXT DEFAULT 'All',
  active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_point_rules_order ON point_rules(sort_order, id);

-- Seed with the default rule set (same values the admin UI shipped with).
INSERT OR IGNORE INTO point_rules (id, action, points, frequency, min_level, active, sort_order, updated_at) VALUES
 (1, 'New Registration', 1, 'Once (lifetime)', 'All', 1, 1, (unixepoch() * 1000)),
 (2, 'Daily Login', 1, 'Once per day', 'All', 1, 2, (unixepoch() * 1000)),
 (3, 'Post a Forum Thread', 1, 'Standard: 1/day · Premium/VIP: unlimited', 'All', 1, 3, (unixepoch() * 1000)),
 (4, 'Comment on Article/Post', 1, 'Standard: 1/account · Premium/VIP: unlimited', 'All', 1, 4, (unixepoch() * 1000)),
 (5, 'Upload a Product', 2, 'Per approved product', 'Premium+', 1, 5, (unixepoch() * 1000)),
 (6, 'Publish an Article', 3, 'Per published article', 'Premium+', 1, 6, (unixepoch() * 1000)),
 (7, 'Complete Member Profile', 2, 'Once', 'All', 1, 7, (unixepoch() * 1000)),
 (8, 'Receive an Inquiry', 2, 'Per inquiry received', 'Premium+', 1, 8, (unixepoch() * 1000)),
 (9, 'Refer a New Member', 5, 'Per verified referral', 'All', 1, 9, (unixepoch() * 1000)),
 (10, 'Exhibition Pre-Registration', 1, 'Per exhibition', 'All', 0, 10, (unixepoch() * 1000));
