-- Add status + post_permission to forum_sections so the admin UI is fully real.
-- Run once: npx wrangler d1 execute nexamuse-db --remote --file=src/migrations/016_forum_sections_fields.sql

ALTER TABLE forum_sections ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE forum_sections ADD COLUMN post_permission TEXT DEFAULT 'all';
