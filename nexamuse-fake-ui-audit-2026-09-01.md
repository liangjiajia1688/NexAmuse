# NexAmuse 全站"假功能/未接线"巡检报告

> 巡检时间：2026-09-01  
> 范围：`public/admin/` + `public/pages/`（管理后台 + 前台页面）  
> 判定标准：按钮/表单仅 `alert/showToast/console.log`，无真实 `fetch('/api/...')`；或 `href="#"` 且无有效 `onclick`；或整页使用硬编码数据冒充实时内容。

---

## 一、已修复（本次会话已处理，不再作为新问题）

| 文件 | 处理内容 |
|---|---|
| `admin/articles-categories.html` | 假 Edit 按钮已 disabled + 标注 Static demo |
| `admin/gallery-categories.html` | 假 Edit 按钮已 disabled + 标注 Static demo |
| `admin/gallery.html` | 假 Edit 按钮已 disabled + 标注 Static demo |
| `admin/members-levels.html` | 假 Edit 按钮已 disabled + 标注 Static demo |
| `admin/members-polls.html` | 假 Edit 按钮已 disabled + 标注 Static demo |
| `admin/products-params.html` | 假 Edit 按钮已 disabled + 标注 Static demo |
| `admin/products-tags.html` | 假 Edit 按钮已 disabled + 标注 Static demo |
| `admin/articles-add.html` | Featured Image 上传已写入 `articles.cover` |
| `admin/articles.html` | 文章列表已增加 Cover 缩略图列 |
| `public/pages/member-points.html` | 会员三档权限对比卡已完整列出 ✓/✗ + hover 说明 |
| `admin/members-add.html` | Create Member 改为真实 `POST /api/admin/members`（密码 PBKDF2 哈希入库 + 档案字段），已端到端验证 |
| `admin/members-wechat.html` | WeChat 假连接态 + 假发送 → 诚实标 Demo（Not Connected、发送不投递） |
| `admin/members-lottery.html` | 假抽奖/死按钮 → 诚实标 Demo（样例数据、Draw Now 不记录） |
| `admin/gallery.html` | 假相册/上传/分类 → 诚实标 Demo（样例数据、保存不落库） |

---

## 二、高优先级：明显误导 / 整页假数据

| 文件 | 问题 | 当前行为 | 修复建议 |
|---|---|---|---|
| `admin/settings.html` | 6 个 Save/Update 按钮 | 全部 `alert('saved!')`，无 fetch | 接 `/api/admin/settings` 真实端点 |
| `admin/settings.html` | Enable 2FA 按钮 | 无 `onclick`，死按钮 | 实现 2FA 流程或禁用标注 |
| `admin/members-add.html` | Create Member Account 表单 | ✅ 已修复：真实 `POST /api/admin/members`（见上方"已修复"） | — |
| `admin/members-assistant.html` | Save Settings + 发送按钮 | 仅 `alert` / 无 `onclick` | 接助手配置 API |
| `admin/members-wechat.html` | Send Message + 连接状态 | ✅ 已修复：诚实标 Demo（见上方"已修复"） | — |
| `admin/files.html` | 整个文件管理器 | `showToast`/无操作；`dirs/sampleFiles` 硬编码 | 接对象存储/文件 API |
| `admin/members-lottery.html` | Draw Now / Launch / Preview 等 | ✅ 已修复：诚实标 Demo（见上方"已修复"） | — |
| `admin/gallery.html` | Create Album / Upload / 批量操作 | `showToast` 或空 `onclick`；无实际上传 | 接图库 API + `/api/upload` |
| `pages/product-detail.html` | Quote request / 询价按钮 | `alert('This feature will open the inquiry form')` 但未打开 | 打开真实询价弹窗 |
| `pages/magazine.html` | 整页杂志归档 | 全部硬编码；Load More 为 `href="#"` | 接 CMS/数据源或标注 Demo |
| `pages/login.html` | Forgot password? | `href="#"`，死链接 | 接密码找回流程 |
| `pages/login.html` / `register.html` | Google / LinkedIn 登录注册 | `socialLogin()` 仅提示 coming soon | 接 OAuth 或移除 |

---

## 三、中优先级：新增/删除未接线（但列表真实）

| 文件 | 问题 | 当前行为 | 修复建议 |
|---|---|---|---|
| `admin/articles-categories.html` | Add / Del 分类 | 仅 `showToast`；分类列表硬编码 | 接分类 CRUD API |
| `admin/gallery-categories.html` | Save Category | 仅 `alert` | `POST` 图库分类 API |
| `admin/products-categories.html` | Add Category | `addCat()` 仅 `alert('submitted for review')` | 实现新增或禁用标注 |
| `admin/products-tags.html` | Add Tag | `addTag()` 仅本地重渲，标签硬编码 | `POST /api/admin/tags` |
| `admin/products-params.html` | Save Parameter Group | 无 `onclick` 死按钮 | 接保存 API |
| `admin/members-levels.html` | ➕ Add Group | `showToast('Member groups are not stored in the database yet')` | 复用真实 members-groups API |
| `admin/members-levels.html` | Edit Rules | `showToast` 仅提示，无真实编辑 | 实现等级规则编辑 |
| `admin/members-polls.html` | Publish Poll | 无 `onclick` 死按钮 | 接发布 API |
| `admin/members-assistant.html` | Save Settings | 仅 `alert` | 接助手配置 API |
| `admin/members-wechat.html` | Send Message | 仅 `alert` | 接微信发送 API |
| `admin/exhibitions-crawler.html` | Import | 仅写入 `localStorage`，不落后端 | `POST /api/admin/exhibitions` |

---

## 四、低优先级：占位 `href="#"` / 静态兜底 / 非核心死链

| 文件/位置 | 问题 | 修复建议 |
|---|---|---|
| 多页面顶部/页脚 | `Media Kit`、`Advertise`、`About`、`Privacy`、`Terms`、`Industry Report 2026` 等死链 | 统一指向真实页面或移除 |
| `pages/news.html` | `/api/news` 为空时显示硬编码新闻兜底 | 空数据时显示空状态，不伪装 |
| `pages/exhibitions.html` | Add to Calendar `href="#"` | 生成 `.ics` 下载或移除 |
| `pages/contact.html` | Media Kit 链接 `href="#"` | 指向真实媒体包或移除 |

---

## 五、已确认接好后端（无需处理）

**admin:** `analytics.html`、`ads.html`、`ads-add.html`、`ads-stats.html`、`articles.html`、`articles-add.html`、`articles-ai.html`、`admins.html`、`comments.html`、`companies.html`、`exhibitions.html`、`forum.html`、`forum-sections.html`、`forum-reports.html`、`images.html`、`index.html`、`members.html`、`members-groups.html`、`members-messages.html`、`members-notify.html`、`members-points.html`、`members-unverified.html`、`news-add.html`、`news-categories.html`、`news-list.html`、`news-crawler.html`、`products.html`、`products-add.html`、`products-import.html`

**pages:** `articles.html`、`article.html`、`company.html`、`company-dashboard.html`、`company-products.html`、`company-profile.html`、`contact.html`、`forum.html`、`login.html`（邮箱部分）、`news.html`（列表部分）、`product-detail.html`（加载部分）、`products.html`、`register.html`（邮箱部分）、`suppliers.html`、`exhibitions.html`

---

## 六、建议下一步

1. **先修高优先级**中的 `pages/product-detail.html` 询价按钮和 `pages/login.html` 找回密码，影响前台核心体验。
2. 再处理 `admin/settings.html`、`admin/members-add.html`、`admin/files.html` 等管理后台高频入口。
3. `pages/magazine.html` 整页假数据可暂用"Demo"角标标注，避免误导。
4. 顶部/页脚占位链接最后统一处理。
