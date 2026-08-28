-- Product image gallery and detail images
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  image_type TEXT DEFAULT 'product',
  original_url TEXT,
  compressed_url TEXT,
  original_size INTEGER DEFAULT 0,
  compressed_size INTEGER DEFAULT 0,
  mime_type TEXT DEFAULT 'image/webp',
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (product_id) REFERENCES company_products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_type ON product_images(product_id, image_type);

-- Track image compression jobs / status for admin bulk operations
CREATE TABLE IF NOT EXISTS image_compression_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL,
  old_url TEXT,
  new_url TEXT,
  old_size INTEGER DEFAULT 0,
  new_size INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  message TEXT,
  created_at INTEGER,
  FOREIGN KEY (image_id) REFERENCES product_images(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_image_compression_logs_image ON image_compression_logs(image_id);
