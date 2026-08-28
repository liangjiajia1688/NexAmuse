-- Extend company_products with full catalog fields used by admin/member add form
ALTER TABLE company_products ADD COLUMN short_description TEXT;
ALTER TABLE company_products ADD COLUMN dimensions TEXT;
ALTER TABLE company_products ADD COLUMN weight TEXT;
ALTER TABLE company_products ADD COLUMN power_supply TEXT;
ALTER TABLE company_products ADD COLUMN power_consumption TEXT;
ALTER TABLE company_products ADD COLUMN min_players INTEGER;
ALTER TABLE company_products ADD COLUMN max_players INTEGER;
ALTER TABLE company_products ADD COLUMN age_range TEXT;
ALTER TABLE company_products ADD COLUMN certification TEXT;
ALTER TABLE company_products ADD COLUMN additional_specs TEXT;
ALTER TABLE company_products ADD COLUMN visibility TEXT DEFAULT 'all';
ALTER TABLE company_products ADD COLUMN tags TEXT;
ALTER TABLE company_products ADD COLUMN price_type TEXT;
ALTER TABLE company_products ADD COLUMN min_price TEXT;
ALTER TABLE company_products ADD COLUMN max_price TEXT;

CREATE INDEX IF NOT EXISTS idx_company_products_category ON company_products(category);
CREATE INDEX IF NOT EXISTS idx_company_products_featured ON company_products(featured DESC, created_at DESC);
