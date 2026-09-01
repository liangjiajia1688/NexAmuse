ALTER TABLE articles ADD COLUMN company_id INTEGER DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_company ON articles(company_id);
