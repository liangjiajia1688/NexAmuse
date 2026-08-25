-- NexAmuse 平台数据库结构 (Cloudflare D1 / SQLite)
-- 部署后执行：wrangler d1 execute nexamuse-db --remote --file=src/migrations/schema.sql

-- 用户表：普通用户 与 企业用户 共用，用 role 区分
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    UNIQUE NOT NULL,
  username      TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  password_salt TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'user', -- 'user' | 'company'
  created_at    INTEGER NOT NULL
);

-- 企业信息表：role='company' 的用户可创建一条企业主页
CREATE TABLE IF NOT EXISTS companies (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT    NOT NULL,
  description TEXT,
  logo_url    TEXT,
  contact     TEXT,
  website     TEXT,
  location    TEXT,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 二手设备 / 产品表：所有用户均可发布
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  title       TEXT    NOT NULL,
  description TEXT,
  price       REAL,
  cond        TEXT,    -- 新旧程度：全新/9成新/7成新/二手/报废
  category    TEXT,    -- 分类：游戏机/游乐设备/动漫周边/其他
  images      TEXT,    -- JSON 数组，存 ImgBB 返回的图片 URL
  location    TEXT,
  status      TEXT    DEFAULT 'active', -- active | sold | hidden
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 论坛帖子表
CREATE TABLE IF NOT EXISTS forum_posts (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL,
  title     TEXT    NOT NULL,
  content   TEXT    NOT NULL,
  category  TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 论坛回帖表
CREATE TABLE IF NOT EXISTS forum_replies (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id   INTEGER NOT NULL,
  user_id   INTEGER NOT NULL,
  content   TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (post_id) REFERENCES forum_posts(id)
);

-- 新闻聚合表（由 RSS 定时抓取写入）
CREATE TABLE IF NOT EXISTS news (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  summary      TEXT,
  source       TEXT,    -- 出处，如 IGN / 动漫之家
  source_url   TEXT,    -- 原文链接
  image_url    TEXT,
  category     TEXT,    -- 游戏 / 游艺 / 动漫
  published_at INTEGER  -- 原文发布时间戳
);

-- 常用索引
CREATE INDEX IF NOT EXISTS idx_products_user    ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_cat     ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created    ON forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_created     ON news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_user   ON companies(user_id);
