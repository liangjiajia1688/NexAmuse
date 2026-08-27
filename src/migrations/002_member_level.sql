-- NexAmuse D1 migration: member level, status, points and super-admin flag
-- Run once:  npx wrangler d1 execute nexamuse-db --remote --file=src/migrations/002_member_level.sql

-- Member tier (Platinum / Gold / Silver / Standard)
ALTER TABLE users ADD COLUMN level TEXT DEFAULT 'Standard';
-- Credits / loyalty points
ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0;
-- Account status (active / inactive / banned)
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
-- Super-admin flag (1 = 最高管理员, can edit member level)
ALTER TABLE users ADD COLUMN is_super INTEGER DEFAULT 0;

-- Promote existing admins to super-admin so the level-edit feature is usable.
UPDATE users SET is_super = 1 WHERE role = 'admin';
