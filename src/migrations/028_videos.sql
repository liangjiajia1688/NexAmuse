-- 028: Video library (link-based). Users paste a social/video URL; we store
-- metadata only (url, platform, title, cover image hosted on tutu.to, optional
-- embed iframe). The video file itself is NEVER hosted by us — this keeps
-- storage/bandwidth near zero. Displayed on /magazine.html and on company pages.
CREATE TABLE IF NOT EXISTS videos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  INTEGER,
  url         TEXT    NOT NULL,
  platform    TEXT,                       -- youtube | vimeo | tiktok | instagram | other
  title       TEXT,
  cover_url   TEXT,                       -- hosted on tutu.to (or remote fallback)
  embed_html  TEXT,                       -- platform iframe HTML when available
  created_by  INTEGER,
  status      TEXT    DEFAULT 'active',   -- active | deleted
  created_at  INTEGER,
  updated_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_videos_company ON videos(company_id);
CREATE INDEX IF NOT EXISTS idx_videos_status  ON videos(status);
