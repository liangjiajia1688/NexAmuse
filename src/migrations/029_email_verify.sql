-- Email verification columns for users
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN verify_code TEXT;
ALTER TABLE users ADD COLUMN verify_expires INTEGER;
