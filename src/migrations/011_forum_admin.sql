-- Forum moderation fields for the admin Forum Posts screen
-- Run once: npx wrangler d1 execute nexamuse-db --remote --file=src/migrations/011_forum_admin.sql

ALTER TABLE forum_threads ADD COLUMN locked INTEGER DEFAULT 0;
ALTER TABLE forum_threads ADD COLUMN reported INTEGER DEFAULT 0;
ALTER TABLE forum_threads ADD COLUMN status TEXT DEFAULT 'published';
