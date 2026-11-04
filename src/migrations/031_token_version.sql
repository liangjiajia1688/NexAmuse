-- Per-user token version: bumping it invalidates every issued session token.
-- Allows real logout (server-side revocation) instead of relying on the
-- browser deleting its cookie.
ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0;
