-- Company directory tables for Premium/VIP member-managed listings
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  country TEXT,
  city TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  logo TEXT,
  primary_category TEXT,
  description TEXT,
  established_year INTEGER,
  company_size TEXT,
  certifications TEXT,
  status TEXT DEFAULT 'pending',
  featured INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  products_count INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS company_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT,
  description TEXT,
  price TEXT,
  moq TEXT,
  image TEXT,
  status TEXT DEFAULT 'active',
  featured INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_owner ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_featured ON companies(featured DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_products_company ON company_products(company_id);
CREATE INDEX IF NOT EXISTS idx_company_products_status ON company_products(status);
