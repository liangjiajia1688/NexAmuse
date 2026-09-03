-- Pre-registration email verification codes (sent before the account exists).
CREATE TABLE IF NOT EXISTS email_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires INTEGER NOT NULL,
  created_at INTEGER
);
