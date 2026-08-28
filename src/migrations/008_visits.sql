-- Visits / analytics tracking table
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT,
  referrer TEXT,
  country TEXT,
  ip TEXT,
  ua TEXT,
  device TEXT,
  is_bot INTEGER DEFAULT 0,
  source TEXT,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at);
CREATE INDEX IF NOT EXISTS idx_visits_country ON visits(country);
CREATE INDEX IF NOT EXISTS idx_visits_source ON visits(source);
CREATE INDEX IF NOT EXISTS idx_visits_device ON visits(device);
CREATE INDEX IF NOT EXISTS idx_visits_bot ON visits(is_bot);
