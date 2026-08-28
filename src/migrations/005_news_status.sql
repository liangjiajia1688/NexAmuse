-- Add publish status to news table and backfill existing rows as published.
-- Run: npx wrangler d1 execute nexamuse-db --remote --file=src/migrations/005_news_status.sql

ALTER TABLE news ADD COLUMN status TEXT DEFAULT 'pending';
ALTER TABLE news ADD COLUMN created_at INTEGER;

UPDATE news SET status = 'published' WHERE status IS NULL;
UPDATE news SET created_at = published_at WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_news_status ON news(status);
