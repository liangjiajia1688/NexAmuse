// 抓取 GTI China 产品库(tyid=19) 的参展商线索 → exhibitors.csv
// 走系统代理 curl 抓服务端渲染 HTML，正则提取企业联系方式。
// 改进：按 email/phone 折叠为「唯一公司」(去重)，一个公司一行，附带其产品列表。
// 用法: node _scrape_gti.cjs [MAX_PAGE]   (默认 25 页)
const { execSync } = require('child_process');
const fs = require('fs');

const PROXY = 'http://127.0.0.1:4697';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const BASE = 'https://gtichinaamuse.com';
const TYID = 19;                                   // 产品库
const MAX_PAGE = parseInt(process.argv[2] || '25', 10); // 列表页数量
// 阻塞式延时（不依赖 shell 的 sleep 命令，跨平台安全）
const sleep = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (e) {} };

function fetchUrl(u, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const out = execSync(`curl -s -L -x ${PROXY} -m 12 -A ${JSON.stringify(UA)} ${JSON.stringify(u)}`,
        { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 });
      if (out && out.length > 200) return out;     // 跳过空壳/超时页
    } catch (e) { /* retry */ }
    sleep(500);
  }
  return '';
}
function clean(s) { return (s || '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); }
function first(re, html) { const m = html.match(re); return m ? clean(m[1]) : ''; }

// 1) 列表页收集 /cp/details?id=
const ids = new Set();
for (let p = 1; p <= MAX_PAGE; p++) {
  const list = fetchUrl(`${BASE}/cp/index?PageIndex=${p}&tyid=${TYID}`);
  const m = list.matchAll(/href="\/cp\/details\?id=(\d+)"/g);
  let n = 0;
  for (const x of m) { ids.add(x[1]); n++; }
  console.error(`page ${p}: +${n} links, total ${ids.size}`);
  sleep(300);
}

// 2) 抓每个详情页，提取联系方式，按 公司 折叠
const companyRe = /公司|有限公司|厂|实业|集团|科技|电子|机械|设备|动漫|文化|贸易|进出口|玩具有限|游戏/;
const companies = new Map();   // key=email||phone  -> 公司对象
let detailCount = 0;
for (const id of ids) {
  const d = fetchUrl(`${BASE}/cp/details?id=${id}`);
  if (!d) continue;
  detailCount++;
  const title = first(/<title>([^<]*)<\/title>/, d);
  const contact = first(/联系人：([^<]+)/, d);
  const mobile = first(/手机：([^<]+)/, d);
  const tel = first(/电话：([^<]+)/, d);
  const email = first(/邮箱：([^<]+)/, d);
  const address = first(/地址：([^<]+)/, d);
  const web = (d.match(/href="(\/home\?id=\d+)"/) || [])[1] || '';
  const phone = mobile || tel;
  if (!email && !phone) continue;            // 无联系方式不可跟进，跳过

  const isCompanyTitle = companyRe.test(title);
  const companyName = isCompanyTitle ? title : '';
  const product = isCompanyTitle ? '' : title;

  const key = (email || phone).trim().toLowerCase();
  if (!companies.has(key)) {
    companies.set(key, {
      company_name: companyName, contact_name: contact, phone, email,
      address, website: web ? BASE + web : '', source: 'GTI China 2026', products: [],
    });
  }
  const c = companies.get(key);
  if (product && !c.products.includes(product)) c.products.push(product);
  sleep(200);
}
console.error(`fetched ${detailCount} detail pages -> ${companies.size} unique companies`);

// 3) 写 CSV（含表头，BOM 防 Excel 中文乱码）
const header = ['company_name', 'contact_name', 'phone', 'email', 'address', 'website', 'source', 'product'];
const esc = (v) => `"${(v == null ? '' : String(v)).replace(/"/g, '""')}"`;
const lines = [header.join(',')];
for (const c of companies.values()) {
  lines.push(header.map((h) => esc(h === 'product' ? c.products.join('; ') : c[h])).join(','));
}
fs.writeFileSync('exhibitors.csv', '﻿' + lines.join('\n'), 'utf8');
console.error(`WROTE ${companies.size} unique companies -> exhibitors.csv`);
