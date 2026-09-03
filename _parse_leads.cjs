// Parse exhibitors.csv -> _rows.json ({rows:[...]}) for /api/admin/leads import.
const fs = require('fs');
const txt = fs.readFileSync('exhibitors.csv', 'utf8').replace(/^﻿/, '');
const lines = txt.split(/\r?\n/).filter(l => l.length);

function parseLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

const header = parseLine(lines[0]).map(h => h.trim());
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const cells = parseLine(lines[i]);
  if (cells.length < header.length) continue;
  const o = {};
  header.forEach((h, idx) => { o[h] = (cells[idx] || '').trim(); });
  if (!o.email && !o.phone) continue; // importer skips these anyway
  rows.push(o);
}
fs.writeFileSync('_rows.json', JSON.stringify({ rows }));
console.log('parsed companies:', rows.length);
