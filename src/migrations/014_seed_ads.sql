-- Seed sample active ads so frontend ad slots render immediately.
-- These are REAL rows in the ads table; admins can edit/remove them in Admin › Ads.
INSERT INTO ads (title, client, zone, slot, size, status, image_url, link_url, alt_text, emoji, start_date, end_date, pricing_model, budget, spent, impressions, clicks, priority, created_at, updated_at)
VALUES
  ('GTI Asia 2026 — Book Your Booth', 'NexAmuse Media', 'homepage', 'Homepage Hero Banner', '960x200', 'active', NULL, '/pages/suppliers.html', 'GTI Asia 2026', '🎪', '2026-01-01', '2027-12-31', 'CPM', 0, 0, 0, 0, 5, strftime('%s','now'), strftime('%s','now')),
  ('Feature Your Product Here', 'NexAmuse Media', 'products', 'Products Category Header', '960x200', 'active', NULL, '/pages/products.html', 'Feature your product', '🎮', '2026-01-01', '2027-12-31', 'CPM', 0, 0, 0, 0, 5, strftime('%s','now'), strftime('%s','now')),
  ('Become a Verified Supplier', 'NexAmuse Media', 'sidebar', 'Sidebar Rectangle', '300x250', 'active', NULL, '/pages/company-profile.html', 'Become a verified supplier', '🏭', '2026-01-01', '2027-12-31', 'CPM', 0, 0, 0, 0, 5, strftime('%s','now'), strftime('%s','now')),
  ('Sponsor the NexAmuse Editorial', 'NexAmuse Media', 'article', 'Article Leaderboard', '728x90', 'active', NULL, '/pages/articles.html', 'Sponsor our editorial', '📰', '2026-01-01', '2027-12-31', 'CPM', 0, 0, 0, 0, 5, strftime('%s','now'), strftime('%s','now')),
  ('Advertise with NexAmuse — Reach 180+ Countries', 'NexAmuse Media', 'ticker', 'News Ticker Strip', '1200x60', 'active', NULL, '/pages/contact.html', 'Advertise with us', '📢', '2026-01-01', '2027-12-31', 'CPM', 0, 0, 0, 0, 5, strftime('%s','now'), strftime('%s','now'));
