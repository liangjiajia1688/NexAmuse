-- NexAmuse D1 migration: advertising zones + points ledger
-- Run once:  npx wrangler d1 execute nexamuse-db --remote --file=src/migrations/012_ads_points.sql

-- ── Advertisements ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  client TEXT,
  zone TEXT NOT NULL DEFAULT 'homepage',
  slot TEXT,
  size TEXT,
  status TEXT DEFAULT 'pending',
  image_url TEXT,
  link_url TEXT,
  alt_text TEXT,
  html_code TEXT,
  emoji TEXT,
  start_date TEXT,
  end_date TEXT,
  pricing_model TEXT DEFAULT 'CPM',
  unit_price REAL DEFAULT 0,
  budget REAL DEFAULT 0,
  spent REAL DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 2,
  target_audience TEXT DEFAULT 'all',
  region TEXT DEFAULT 'all',
  frequency TEXT DEFAULT 'always',
  notes TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);
CREATE INDEX IF NOT EXISTS idx_ads_zone ON ads(zone);
CREATE INDEX IF NOT EXISTS idx_ads_created ON ads(created_at DESC);

-- ── Daily ad statistics (for charts) ───────────────────────────
CREATE TABLE IF NOT EXISTS ads_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  UNIQUE(ad_id, day),
  FOREIGN KEY (ad_id) REFERENCES ads(id)
);

CREATE INDEX IF NOT EXISTS idx_ads_daily_day ON ads_daily(day);
CREATE INDEX IF NOT EXISTS idx_ads_daily_ad ON ads_daily(ad_id);

-- ── Points / credits ledger ────────────────────────────────────
CREATE TABLE IF NOT EXISTS point_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  balance INTEGER NOT NULL,
  action TEXT,
  reason TEXT,
  admin_id INTEGER,
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_point_logs_user ON point_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_point_logs_created ON point_logs(created_at DESC);
