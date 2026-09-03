-- Add updated_at column to articles for PUT save path
ALTER TABLE articles ADD COLUMN updated_at INTEGER;
