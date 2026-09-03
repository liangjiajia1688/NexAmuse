// 把 exhibitors.csv 解析为 _rows.json（供直接 POST /api/admin/leads 使用）
// 列：company_name, contact_name, phone, email, address, website, source, product
// 后端 leads.js 读 r.products || r.product，这里把 product 列映射到 products 字段。
const fs = require('fs');
function splitCSVLine(line){
  const out=[]; let cur='', q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(q){ if(c==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
    else { if(c==='"') q=true; else if(c===','){ out.push(cur); cur=''; } else cur+=c; }
  }
  out.push(cur);
  return out;
}
const text = fs.readFileSync('exhibitors.csv','utf8').replace(/^\uFEFF/,'');
const lines = text.split(/\r?\n/).filter(l=>l.trim());
const header = splitCSVLine(lines[0]).map(h=>h.trim());
const rows = [];
for(let i=1;i<lines.length;i++){
  const cells = splitCSVLine(lines[i]);
  const row = {};
  header.forEach((h,idx)=> row[h] = (cells[idx]!==undefined?cells[idx]:'').trim());
  if(!(row.email||row.phone)) continue;            // 无联系方式跳过
  rows.push({
    company_name: row.company_name||'', contact_name: row.contact_name||'',
    phone: row.phone||'', email: row.email||'', address: row.address||'',
    website: row.website||'', source: row.source||'GTI China 2026',
    products: row.product||'',
  });
}
fs.writeFileSync('_rows.json', JSON.stringify({ rows }));
console.error(`PARSED ${rows.length} importable rows -> _rows.json`);
