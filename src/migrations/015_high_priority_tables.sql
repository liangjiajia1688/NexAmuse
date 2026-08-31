-- 015: Tables for the high-priority "make it real" batch.
-- admin_logs, forum_reports, messages, notifications, member_groups, contacts.
-- forum_sections already exists — seed a few rows so the admin page is populated.

-- ── Admin audit log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  detail TEXT,
  ip TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

-- ── Forum reports queue ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER,
  thread_id INTEGER,
  reply_id INTEGER,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  handled_by INTEGER,
  handled_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_forum_reports_status ON forum_reports(status);

-- ── Internal member messages ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER,
  to_id INTEGER,
  subject TEXT,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  parent_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_id, is_read);

-- ── Notifications ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- ── Member groups / tiers ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  min_points INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- ── Contact form submissions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);

-- ── Seed: forum sections (table exists, populate it) ──────────────
INSERT INTO forum_sections (name, slug, description, icon, sort_order)
SELECT 'Announcements', 'announcements', 'Official NexAmuse news and updates', '📢', 1
WHERE NOT EXISTS (SELECT 1 FROM forum_sections WHERE slug='announcements');
INSERT INTO forum_sections (name, slug, description, icon, sort_order)
SELECT 'Supplier Lounge', 'supplier-lounge', 'Meet manufacturers and factories', '🏭', 2
WHERE NOT EXISTS (SELECT 1 FROM forum_sections WHERE slug='supplier-lounge');
INSERT INTO forum_sections (name, slug, description, icon, sort_order)
SELECT 'Buyer Requests', 'buyer-requests', 'Post what you are sourcing', '🛒', 3
WHERE NOT EXISTS (SELECT 1 FROM forum_sections WHERE slug='buyer-requests');
INSERT INTO forum_sections (name, slug, description, icon, sort_order)
SELECT 'Tech & Trends', 'tech-trends', 'VR, AR, robotics and what is next', '🤖', 4
WHERE NOT EXISTS (SELECT 1 FROM forum_sections WHERE slug='tech-trends');
INSERT INTO forum_sections (name, slug, description, icon, sort_order)
SELECT 'Events & Meetups', 'events', 'Trade shows and local gatherings', '🎪', 5
WHERE NOT EXISTS (SELECT 1 FROM forum_sections WHERE slug='events');

-- ── Seed: member groups ───────────────────────────────────────────
INSERT INTO member_groups (name, description, color, min_points, created_at)
SELECT 'Bronze', 'New community members', '#cd7f32', 0, strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM member_groups WHERE name='Bronze');
INSERT INTO member_groups (name, description, color, min_points, created_at)
SELECT 'Silver', 'Active contributors', '#94a3b8', 500, strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM member_groups WHERE name='Silver');
INSERT INTO member_groups (name, description, color, min_points, created_at)
SELECT 'Gold', 'Top industry voices', '#f5d06e', 2000, strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM member_groups WHERE name='Gold');
INSERT INTO member_groups (name, description, color, min_points, created_at)
SELECT 'Platinum', 'Verified partners & VIP', '#c9a227', 5000, strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM member_groups WHERE name='Platinum');

-- ── Seed: sample admin logs (so the audit page is populated) ──────
INSERT INTO admin_logs (admin_id, action, target_type, target_id, detail, ip, created_at) VALUES
 (2, 'login', 'session', NULL, 'Signed in from dashboard', '203.0.113.7', strftime('%s','now') - 60),
 (2, 'ad_update', 'ad', 2, 'Updated homepage hero creative', '203.0.113.7', strftime('%s','now') - 3600),
 (2, 'member_verify', 'user', 1, 'Approved supplier verification', '203.0.113.7', strftime('%s','now') - 86400),
 (2, 'forum_report_resolve', 'report', 1, 'Dismissed spam report', '203.0.113.7', strftime('%s','now') - 172800);

-- ── Seed: sample forum reports ────────────────────────────────────
INSERT INTO forum_reports (reporter_id, thread_id, reason, detail, status, created_at) VALUES
 (1, NULL, 'spam', 'Repeated promotional links in multiple threads', 'pending', strftime('%s','now') - 7200),
 (1, NULL, 'harassment', 'Offensive reply directed at another member', 'pending', strftime('%s','now') - 50400),
 (1, NULL, 'off_topic', 'Post belongs in a different section', 'pending', strftime('%s','now') - 1209600);

-- ── Seed: sample internal messages ────────────────────────────────
INSERT INTO messages (from_id, to_id, subject, body, is_read, created_at) VALUES
 (2, 1, 'Welcome aboard', 'Glad to have you in the NexAmuse network.', 1, strftime('%s','now') - 86400),
 (1, 2, 'Verification question', 'How long does supplier approval take?', 0, strftime('%s','now') - 3600),
 (2, 1, 'Re: Verification question', 'Usually 24-48 hours after document upload.', 0, strftime('%s','now') - 1800);

-- ── Seed: sample notifications ────────────────────────────────────
INSERT INTO notifications (user_id, type, title, body, link, is_read, created_at) VALUES
 (1, 'system', 'Welcome to NexAmuse', 'Complete your company profile to get verified.', '/pages/company-profile.html', 0, strftime('%s','now') - 86400),
 (1, 'points', 'You earned 50 points', 'Weekly login streak bonus.', '/pages/member-points.html', 0, strftime('%s','now') - 43200),
 (1, 'message', 'New message from Admin', 'You have a new internal message.', '/admin/members-messages.html', 1, strftime('%s','now') - 1800);
