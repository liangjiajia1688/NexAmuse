-- NexAmuse D1 schema
-- Run once:  npx wrangler d1 execute nexamuse-db --remote --file=src/migrations/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  avatar TEXT,
  level TEXT DEFAULT 'Standard',
  points INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  is_super INTEGER DEFAULT 0,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  category TEXT,
  cover TEXT,
  author TEXT,
  user_id INTEGER,
  status TEXT DEFAULT 'published',
  published_at INTEGER,
  views INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  user_id INTEGER,
  name TEXT,
  email TEXT,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'approved',
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT UNIQUE,
  source TEXT,
  image TEXT,
  category TEXT,
  published_at INTEGER
);

CREATE TABLE IF NOT EXISTS exhibitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT,
  venue TEXT,
  country TEXT,
  startDate TEXT,
  endDate TEXT,
  status TEXT,
  category TEXT,
  region TEXT,
  flag TEXT,
  scale TEXT,
  description TEXT,
  url TEXT,
  featured INTEGER DEFAULT 0,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_exhibitions_start ON exhibitions(startDate);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);

-- Site Assistant configuration (single-row settings store)
CREATE TABLE IF NOT EXISTS assistant_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  config TEXT NOT NULL,
  updated_at INTEGER
);

-- Admin site settings, stored per section as JSON (key = section name)
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER
);
