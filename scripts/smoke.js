// Minimal smoke tests for helper logic (no dependencies)
function plusify(string) { return String(string || '').trim().replace(/\s+/g, '+'); }
const CSV = {
  parse(text) {
    const rows = []; let cur = [], val = '', i = 0, inQ = false;
    while (i < text.length) {
      const c = text[i];
      if (inQ) { if (c === '"') { if (text[i+1] === '"') { val += '"'; i+=2; continue; } inQ=false; i++; continue; } val+=c; i++; continue; }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { cur.push(val); val=''; i++; continue; }
      if (c === '\n') { cur.push(val); rows.push(cur); cur=[]; val=''; i++; continue; }
      if (c === '\r') { i++; continue; }
      val += c; i++;
    }
    if (val.length || cur.length) { cur.push(val); rows.push(cur); }
    return rows;
  },
  stringify(rows) {
    const esc = (s) => { const str = String(s ?? ''); return /[",\n\r]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str; };
    return rows.map(r => r.map(esc).join(',')).join('\n');
  }
};

function run() {
  const results = [];
  results.push(['plusify basic', plusify('a b  c') === 'a+b+c']);
  results.push(['plusify trims', plusify('  hello  world ') === 'hello+world']);
  const inRows = [['a','b,c','"q"'], ['1','2','3']];
  const csv = CSV.stringify(inRows);
  const outRows = CSV.parse(csv);
  results.push(['csv stringify/parse roundtrip', JSON.stringify(outRows) === JSON.stringify(inRows)]);

  const ok = results.every(([, pass]) => pass);
  console.log(results.map(([name, pass]) => `${pass ? '✅' : '❌'} ${name}`).join('\n'));
  if (!ok) process.exit(1);
}

run();

