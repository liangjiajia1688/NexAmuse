import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

// Rule-based intent engine. Each intent lists trigger keywords (EN + 中文) and
// a canned reply plus deep links into the site. The first matching intent wins.
const INTENTS = [
  {
    keys: ['vr', 'virtual reality', 'headset', 'metaverse'],
    text: "We have a great selection of VR and immersive attractions — from standalone VR rigs to full free-roam arenas. What footprint and budget do you have in mind?",
    links: [{ label: 'Browse VR Equipment', href: '/pages/products.html?cat=vr' }],
  },
  {
    keys: ['supplier', 'manufacturer', 'factory', 'vendor', 'source', 'oem', '供应商', '工厂', '厂家'],
    text: "You can browse verified suppliers and manufacturers on our Suppliers directory. Filter by category, region and certifications to shortlist the right partners.",
    links: [{ label: 'View Suppliers', href: '/pages/suppliers.html' }],
  },
  {
    keys: ['exhibition', 'expo', 'trade show', 'trade fair', 'iaapa', 'gti', 'amusement show', '展会', '展会上'],
    text: "Here are the upcoming global amusement & FEC trade shows — IAAPA, GTI, DEAL and more. Great for sourcing and networking.",
    links: [{ label: 'Upcoming Exhibitions', href: '/pages/exhibitions.html' }],
  },
  {
    keys: ['article', 'news', 'blog', 'report', 'analysis', 'industry', '新闻', '文章', '分析'],
    text: "Our editorial team publishes market analysis, buyer's guides and industry news weekly. Start with the latest pieces below.",
    links: [
      { label: 'Read Articles', href: '/pages/articles.html' },
      { label: 'Industry News', href: '/pages/news.html' },
    ],
  },
  {
    keys: ['product', 'machine', 'equipment', 'arcade', 'game', 'ride', 'claw', '设备', '机器', '游乐', '娃娃机'],
    text: "Browse our full catalogue of amusement machines, arcade games and FEC equipment. You can filter by category and supplier.",
    links: [{ label: 'Browse Products', href: '/pages/products.html' }],
  },
  {
    keys: ['price', 'cost', 'roi', 'budget', 'investment', '投资', '价格', '回本', '多少钱'],
    text: "ROI matters. Check our operator buying guides where we tested 40+ machines and highlight the ones that pay back within 12 months.",
    links: [{ label: 'Best-ROI Guide', href: '/pages/articles.html' }],
  },
  {
    keys: ['company', 'profile', 'brand', '企业', '公司', '品牌'],
    text: "Suppliers can claim a public company profile to showcase products and get discovered by buyers. Premium members and above can create one.",
    links: [{ label: 'Create Company Profile', href: '/pages/company-profile.html' }, { label: 'Membership Tiers', href: '/pages/member-points.html' }],
  },
  {
    keys: ['membership', 'vip', 'premium', '会员', '升级'],
    text: "NexAmuse has three tiers — Standard (free), Premium and VIP. Higher tiers unlock product listings, articles, analytics and priority placement.",
    links: [{ label: 'Membership Tiers', href: '/pages/member-points.html' }],
  },
  {
    keys: ['login', 'sign in', 'log in', '登录'],
    text: "Welcome back! Log in to access your dashboard, inquiries and membership perks.",
    links: [{ label: 'Log In', href: '/pages/login.html' }, { label: 'Register', href: '/pages/register.html' }],
  },
  {
    keys: ['register', 'sign up', 'join', '注册', '开户'],
    text: "Creating a free Standard account takes a minute and unlocks forum posting, supplier inquiries and exhibition pre-registration.",
    links: [{ label: 'Register', href: '/pages/register.html' }, { label: 'Membership Tiers', href: '/pages/member-points.html' }],
  },
  {
    keys: ['contact', 'support', 'help', 'sales', '联系', '客服', '支持'],
    text: "Our team is happy to help. Reach out via the contact page and we'll get back to you quickly.",
    links: [{ label: 'Contact Us', href: '/pages/contact.html' }],
  },
];

const FALLBACK = {
  text: "I'm Nex, your guide to NexAmuse Global 🙂 I can point you to VR equipment, suppliers, exhibitions, articles, products or membership info. What are you looking for today?",
  links: [
    { label: 'Browse Products', href: '/pages/products.html' },
    { label: 'Find Suppliers', href: '/pages/suppliers.html' },
    { label: 'Upcoming Exhibitions', href: '/pages/exhibitions.html' },
  ],
};

function matchIntent(msg) {
  const m = (msg || '').toLowerCase();
  for (const it of INTENTS) {
    if (it.keys.some((k) => m.includes(k))) return it;
  }
  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return fail('Invalid JSON', 400); }
  const message = String(body.message || '').trim();
  if (!message) return fail('message is required', 400);

  // Optional: if an AI key is configured AND enableAi is on, you could route
  // here. For now we stay fully rule-based as requested.
  const intent = matchIntent(message);
  const reply = intent || FALLBACK;
  return json({ ok: true, text: reply.text, links: reply.links || [] });
}
