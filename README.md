# NexAmuse 平台

全球游戏 / 游艺 / 动漫行业的**二手设备交易 + 企业展示 + 论坛 + 全球新闻聚合**平台。

> 基于你现有的 NexAmuse 展示站改造而来：保留了原有深色 + 金色设计风格，新增了用户系统、二手设备发布、企业主页、论坛、以及自动聚合的全球行业新闻。

## 功能

| 模块 | 说明 |
|------|------|
| **用户系统** | 注册 / 登录（密码 PBKDF2 哈希 + Token 鉴权）。支持「普通用户」与「企业账号」两种角色 |
| **二手设备市场** | 任何登录用户可发布二手游戏机 / 游乐设备，支持多图上传（ImgBB）、分类、新旧程度、价格、所在地 |
| **企业主页** | 企业账号可创建专属展示页，并发布本公司产品 |
| **论坛** | 所有注册用户可发帖、回复，按分类浏览 |
| **行业新闻** | 定时抓取全球游戏 / 动漫媒体 RSS，仅存标题 + 摘要 + 出处 + 原文链接（合规聚合，不搬运全文） |

## 技术架构

```
GitHub 仓库
   ↓ (push / Action)
Cloudflare Pages 拉取部署   （静态前端 public/ + Pages Functions 后端 functions/）
   ↓
D1 数据库 (SQLite)          ← 用户 / 产品 / 企业 / 论坛 / 新闻
   ↓
ImgBB                      ← 图片存储（免费，无需银行卡）
   ↓
GitHub Action 每日定时      ← 触发 /api/news-refresh 抓取新闻
```

- 前端：原生 HTML / CSS / JS（沿用现有设计）
- 后端：Cloudflare Pages Functions（与前端同源部署）
- 数据库：Cloudflare D1
- 图片：ImgBB API（环境变量 `IMGBB_API_KEY`）

## 部署步骤

### 1. 推送到 GitHub
```bash
git init
git add .
git commit -m "NexAmuse platform"
git remote add origin <你的仓库地址>
git push -u origin main
```

### 2. Cloudflare Pages 连接仓库
- Cloudflare 控制台 → **Workers & Pages → 创建 → Pages → 连接到 Git**
- 构建命令：留空（无需构建）
- **构建输出目录（Build output directory）：`public`**
- 框架预设：无（None）

### 3. 创建并绑定 D1 数据库
```bash
# 安装 wrangler（本地）
npm install
# 创建 D1 数据库，记下返回的 database_id
npx wrangler d1 create nexamuse-db
```
把 `wrangler.toml` 里的 `database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"` 替换成实际 ID。
然后在 Cloudflare 控制台 **Pages 项目 → 设置 → 函数 → D1 数据库绑定**，绑定变量名 `DB` 到 `nexamuse-db`。

### 4. 配置环境变量
Cloudflare 控制台 **Pages 项目 → 设置 → 环境变量**，添加（生产环境）：
- `IMGBB_API_KEY` = 你的 ImgBB API Key（https://api.imgbb.com/ 登录后获取）
- `TOKEN_SECRET` = 一段随机长字符串（用于 Token 签名，务必自己生成）

> ⚠️ 本项目 `.dev.vars` 里的 key 仅用于本地开发，请勿提交到公开仓库。

### 5. 初始化数据库表结构
```bash
npx wrangler d1 execute nexamuse-db --remote --file=src/migrations/schema.sql
```

### 6. 触发一次新闻抓取
部署后访问：`https://你的域名/api/news-refresh?key=你的TOKEN_SECRET`
之后由 GitHub Action 每日自动抓取（见 `.github/workflows/news-refresh.yml`，需在仓库 Secrets 配置 `SITE_URL` 和 `TOKEN_SECRET`）。

## 本地开发
```bash
npm install
npx wrangler pages dev public
```
本地需在 `.dev.vars` 配置 `IMGBB_API_KEY` 和 `TOKEN_SECRET`（已在项目中，正式部署请更换）。

## 目录结构
```
public/            前端静态文件（index.html + pages/ + assets/）
functions/         Pages Functions 后端 API（/api/*）
src/lib/           鉴权、图片上传、数据库工具
src/migrations/    D1 表结构 schema.sql
```
