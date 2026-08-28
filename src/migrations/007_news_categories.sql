CREATE TABLE IF NOT EXISTS news_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO news_categories (code, name, sort) VALUES
  ('industry',   'Industry Dynamics',      1),
  ('companies',  'Company News',           2),
  ('interviews', 'Executive Interviews',   3),
  ('exhibitions','Exhibition News',        4),
  ('technology', 'Technology',             5),
  ('regulation', 'Regulations & Compliance',6);
