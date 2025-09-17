// Storage and Configuration
const STORAGE_KEY = "cid-generator-v1";
const GOOGLE_API_KEY = "AIzaSyD4Njem--rFlGOjQ-h-fST7efu3lAtFzKM";

function saveAll() {
  const toStore = {
    columns: state.columns,
    rows: state.rows,
    template: state.template
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

function loadAll() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data.columns)) state.columns = data.columns;
    if (Array.isArray(data.rows)) state.rows = data.rows;
    if (typeof data.template === 'string') state.template = data.template;
    return true;
  } catch { return false; }
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  state.columns = defaultColumns();
  state.rows = [];
  state.template = '{{FinalUrl}}';
}

// Column Management
function defaultColumns() {
  return [
    { name: 'OriginalSearch', label: 'A: Original Search', kind: 'input' },
    { name: 'Brand', label: 'B: GMB Brand', kind: 'input' },
    { name: 'LocationCID', label: 'D: Location CID', kind: 'input' },
    { name: 'GMBCID', label: 'E: GMB CID', kind: 'input' },
    { name: 'SearchBase', label: 'I: Search Template', kind: 'computed', formula: '"https://www.google.com/search?q=keyword&oq=original&rldimm=000&rlst=f#rlfi=hd:;si=111"' },
    { name: 'FinalUrl', label: 'H: Final URL', kind: 'computed', formula: 'replace(replace(replace(replace(SearchBase, "keyword", replace(lower(Brand), " ", "+")), "original", replace(OriginalSearch, " ", "+")), "000", LocationCID), "111", GMBCID)' }
  ];
}

function addColumn() {
  const name = document.getElementById('newColName')?.value.trim();
  const kind = document.getElementById('newColKind')?.value;
  const formula = document.getElementById('newColFormula')?.value;

  if (!name) return;
  const exists = state.columns.some(c => c.name === name);
  if (exists) {
    flash('Column already exists');
    return;
  }

  const col = { name, kind };
  if (kind === 'computed') col.formula = formula || '';
  state.columns.push(col);

  if (document.getElementById('newColName')) document.getElementById('newColName').value = '';
  if (document.getElementById('newColFormula')) document.getElementById('newColFormula').value = '';

  renderAll();
}

function removeColumn(index) {
  const col = state.columns[index];
  state.columns.splice(index, 1);
  for (const r of state.rows) delete r[col.name];
  renderAll();
}

function moveColumn(index, direction) {
  if (direction === 'up' && index > 0) {
    const [col] = state.columns.splice(index, 1);
    state.columns.splice(index - 1, 0, col);
    renderAll();
  } else if (direction === 'down' && index < state.columns.length - 1) {
    const [col] = state.columns.splice(index, 1);
    state.columns.splice(index + 1, 0, col);
    renderAll();
  }
}

// Data Management
const state = {
  view: 'input',
  columns: [],
  rows: [],
  template: '{{FinalUrl}}'
};

function addRow() {
  state.rows.push({});
  renderAll();
}

function clearRows() {
  state.rows = [];
  renderAll();
}

function computeRow(row, index, total) {
  const ctxBase = { ...row, rowIndex: index, totalRows: total, now: new Date() };
  const out = { ...row };

  for (const col of state.columns) {
    if (col.kind === 'computed') {
      try {
        out[col.name] = evaluateFormula(col.formula || '', ctxBase);
      } catch (e) {
        out[col.name] = `[[ERR: ${e.message}]]`;
      }
    }
  }
  return out;
}

// Formula Engine
const formulaFunctions = {
  concat: (...args) => args.map(x => String(x ?? '')).join(''),
  upper: (s) => String(s ?? '').toUpperCase(),
  lower: (s) => String(s ?? '').toLowerCase(),
  trim: (s) => String(s ?? '').trim(),
  replace: (s, a, b) => String(s ?? '').split(String(a ?? '')).join(String(b ?? '')),
  default: (v, fb) => (v == null || v === '') ? fb : v
};

function evaluateFormula(formula, context) {
  if (!formula) return '';
  const s = formula.trim();

  // String literal
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/""/g, '"');
  }

  // Function call
  const m = s.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);
  if (m) {
    const name = m[1];
    const argsInner = m[2].trim();
    const args = argsInner.length ? splitArgs(argsInner).map(a => parseArg(a, context)) : [];

    if (!(name in formulaFunctions)) {
      throw new Error(`Unknown function: ${name}`);
    }
    return formulaFunctions[name](...args);
  }

  // Variable/identifier
  return context[s];
}

function renderTemplate(template, context) {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, body) => {
    try {
      return String(evaluateFormula(body, context) ?? '');
    } catch (e) {
      return `[[ERR: ${e.message}]]`;
    }
  });
}

function parseArg(token, ctx) {
  token = token.trim();
  if (token.startsWith('"') && token.endsWith('"')) {
    return token.slice(1, -1).replace(/""/g, '"');
  }
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);

  const fm = token.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*\)$/);
  if (fm) return evaluateFormula(token, ctx);

  return ctx[token];
}

function splitArgs(inner) {
  const args = [];
  let cur = '', inQ = false, i = 0;
  while (i < inner.length) {
    const c = inner[i];
    if (inQ) {
      if (c === '"') { inQ = false; cur += c; i++; continue; }
      cur += c; i++; continue;
    }
    if (c === '"') { inQ = true; cur += c; i++; continue; }
    if (c === ',') { args.push(cur.trim()); cur=''; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim().length) args.push(cur.trim());
  return args;
}

// Bulk Import
function importKeywords() {
  const brand = document.getElementById('impBrand')?.value.trim();
  const cidLoc = document.getElementById('impCidLoc')?.value.trim();
  const cidGmb = document.getElementById('impCidGmb')?.value.trim();
  const location = document.getElementById('impLocation')?.value.trim();
  const mode = document.getElementById('impMode')?.value;
  const kwsText = document.getElementById('impKws')?.value;

  // Validation with better error messages
  const errors = [];

  if (!brand) errors.push('GMB Brand Name is required');
  if (!cidLoc) errors.push('Location CID is required');
  if (!cidGmb) errors.push('GMB CID is required');
  if (!validateCID(cidLoc) && cidLoc) errors.push('Location CID must be 10-20 digits');
  if (!validateCID(cidGmb) && cidGmb) errors.push('GMB CID must be 10-20 digits');

  const keywords = kwsText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!keywords.length) errors.push('At least one keyword is required');

  if (errors.length > 0) {
    flashError(`Please fix the following errors: ${errors.join(', ')}`);
    return;
  }

  // Show loading state
  const button = document.getElementById('impInsert');
  if (button) {
    button.classList.add('loading');
    button.disabled = true;
    button.textContent = 'Generating...';
  }

  try {
    populateFromImport(keywords, brand, cidLoc, cidGmb, location, mode);
    flashSuccess(`Successfully imported ${keywords.length} keywords`);
  } catch (error) {
    flashError('Failed to import keywords. Please check your input.');
  } finally {
    // Remove loading state
    if (button) {
      button.classList.remove('loading');
      button.disabled = false;
      button.textContent = 'Generate CID URLs';
    }
  }
}

function populateFromImport(keywords, brand, cidLoc, cidGmb, location, mode = 'append') {
  if (mode === 'replace') state.rows = [];

  for (const kw of keywords) {
    const row = {
      OriginalSearch: kw,
      Brand: brand,
      LocationCID: cidLoc,
      GMBCID: cidGmb
    };
    state.rows.push(row);
  }

  renderAll();
  flash(`Imported ${keywords.length} keywords`);
}

// CID Management
function validateCID(cid) {
  return /^\d{10,20}$/.test(String(cid).trim());
}

function getCIDLibrary() {
  return {
    'Chicago Downtown': '12673312613543755776',
    'Chicago North Side': '15234567890123456789',
    'Chicago South Side': '98765432109876543210',
    'Chicago West Side': '11223344556677889900',
    'Chicago East Side': '99887766554433221100'
  };
}

function addCIDToLibrary(name, cid) {
  if (!validateCID(cid)) {
    flash('Invalid CID format');
    return false;
  }
  const library = getCIDLibrary();
  library[name] = cid;
  return true;
}

// URL Generation
function generateFinalURL(originalSearch, brand, locationCID, gmbCID) {
  const template = 'https://www.google.com/search?q=keyword&oq=original&rldimm=000&rlst=f#rlfi=hd:;si=111';

  return template
    .replace('keyword', plusify(String(brand || '').toLowerCase()))
    .replace('original', plusify(originalSearch || ''))
    .replace('000', locationCID || '')
    .replace('111', gmbCID || '');
}

function buildURLParts(row) {
  const brand = plusify(String(row.Brand || '').toLowerCase());
  const originalSearch = plusify(row.OriginalSearch || '');
  const cidLoc = String(row.LocationCID || '');
  const cidGmb = String(row.GMBCID || '');

  return [
    { t: 'https://www.google.com/search?q=', k: 'const' },
    { t: brand, k: 'brand' },
    { t: '&oq=', k: 'const' },
    { t: originalSearch, k: 'keyword' },
    { t: '&rldimm=', k: 'const' },
    { t: cidLoc, k: 'cidloc' },
    { t: '&rlst=f#rlfi=hd:;si=', k: 'const' },
    { t: cidGmb, k: 'cidgmb' }
  ];
}

function renderComposition() {
  const host = document.getElementById('compositionUrl');
  if (!host) return;

  host.innerHTML = '';
  if (!state.rows.length) {
    host.textContent = 'No data to preview';
    return;
  }

  const total = state.rows.length;
  const row = computeRow(state.rows[0], 0, total);
  const parts = buildURLParts(row);
  const frag = document.createDocumentFragment();

  parts.forEach(p => {
    const span = document.createElement('span');
    span.className = 'seg seg-' + (p.k === 'const' ? 'const' : p.k);
    span.textContent = p.t;
    frag.appendChild(span);
  });

  host.appendChild(frag);
}

// Export/Import
const CSV = {
  parse(text) {
    const rows = [];
    let cur = [];
    let val = '';
    let i = 0, inQ = false;
    while (i < text.length) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i+1] === '"') { val += '"'; i+=2; continue; }
          inQ = false; i++; continue;
        } else { val += c; i++; continue; }
      }
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
    const esc = (s) => {
      const str = String(s ?? '');
      if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
      return str;
    };
    return rows.map(r => r.map(esc).join(',')).join('\n');
  }
};

function exportCSV() {
  const headers = state.columns.map(c => c.name);
  const total = state.rows.length;
  const rows = state.rows.map((r, i) => {
    const full = computeRow(r, i, total);
    return headers.map(h => full[h] ?? '');
  });
  const csv = CSV.stringify([headers, ...rows]);
  downloadBlob(csv, 'text/csv;charset=utf-8', 'cid-generator-data.csv');
}

function importCSV(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    const rows = CSV.parse(text);
    if (!rows.length) return;

    const headers = rows[0];
    const inputCols = state.columns.filter(c => c.kind === 'input').map(c => c.name);
    const newRows = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const obj = {};
      headers.forEach((h, idx) => {
        if (inputCols.includes(h)) obj[h] = r[idx] ?? '';
      });
      newRows.push(obj);
    }

    state.rows = newRows;
    renderAll();
    flash(`Imported ${newRows.length} rows`);
  };
  reader.readAsText(file);
}

function downloadBlob(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// UI Rendering
function renderAll() {
  renderColumns();
  renderTable();
  renderUrlList();
  renderTemplateSection();
  renderComposition();
  updateKeywordCount();

  const isInput = state.view === 'input';
  document.getElementById('urlsPanel').style.display = isInput ? 'none' : '';
}

function renderColumns() {
  // This would render column configuration UI if needed
}

function renderTable() {
  const tbl = document.getElementById('dataTable');
  if (!tbl) return;

  tbl.innerHTML = '';
  const thead = document.createElement('thead');
  const htr = document.createElement('tr');

  const visibleCols = state.columns.filter(c =>
    state.view === 'cid' ? c.name === 'FinalUrl' : c.kind === 'input'
  );

  for (const col of visibleCols) {
    const th = document.createElement('th');
    th.textContent = col.label || col.name;
    htr.appendChild(th);
  }

  const thAct = document.createElement('th');
  thAct.textContent = 'Actions';
  htr.appendChild(thAct);
  thead.appendChild(htr);
  tbl.appendChild(thead);

  const tbody = document.createElement('tbody');
  const total = state.rows.length;

  state.rows.forEach((row, rIdx) => {
    const computed = computeRow(row, rIdx, total);
    const tr = document.createElement('tr');

    for (const col of visibleCols) {
      const td = document.createElement('td');

      if (col.kind === 'input') {
        const inp = document.createElement('input');
        inp.className = 'cell';
        inp.value = row[col.name] ?? '';
        inp.addEventListener('input', () => {
          row[col.name] = inp.value;
          renderComposition();
        });
        td.appendChild(inp);
      } else {
        td.className = 'computed';
        td.textContent = computed[col.name] ?? '';
      }
      tr.appendChild(td);
    }

    const tdAct = document.createElement('td');
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.className = 'danger';
    del.addEventListener('click', () => {
      state.rows.splice(rIdx, 1);
      renderAll();
    });

    const dup = document.createElement('button');
    dup.textContent = 'Duplicate';
    dup.addEventListener('click', () => {
      state.rows.splice(rIdx + 1, 0, JSON.parse(JSON.stringify(row)));
      renderAll();
    });

    tdAct.append(del, dup);
    tr.appendChild(tdAct);
    tbody.appendChild(tr);
  });

  tbl.appendChild(tbody);
}

function renderUrlList() {
  const list = document.getElementById('urlList');
  if (!list) return;

  list.innerHTML = '';
  const total = state.rows.length;
  const urls = state.rows.map((r, i) => computeRow(r, i, total).FinalUrl || '');

  urls.forEach((url, idx) => {
    const li = document.createElement('li');
    li.textContent = url;
    li.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        flash('URL copied!');
      } catch {}
    });
    list.appendChild(li);
  });

  const counter = document.getElementById('urlsCount');
  if (counter) counter.textContent = `(${urls.length})`;
}

function renderTemplateSection() {
  const ta = document.getElementById('template');
  if (ta) ta.value = state.template || '';

  const presets = getTemplatePresets();
  const sel = document.getElementById('tplPresets');
  if (sel) {
    sel.innerHTML = '<option value="">Select preset...</option>';
    for (const key of Object.keys(presets)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key;
      sel.appendChild(opt);
    }
  }
}

// Event Handlers
function bindEvents() {
  // Tab navigation with keyboard support
  const inputTab = document.getElementById('viewInput');
  const cidTab = document.getElementById('viewCid');

  inputTab?.addEventListener('click', () => onTabChange('input'));
  cidTab?.addEventListener('click', () => onTabChange('cid'));

  // Keyboard navigation for tabs
  [inputTab, cidTab].forEach(tab => {
    if (!tab) return;

    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const isInput = tab.id === 'viewInput';
        const targetView = e.key === 'ArrowLeft' ?
          (isInput ? 'cid' : 'input') :
          (isInput ? 'cid' : 'input');
        onTabChange(targetView);
        (targetView === 'input' ? inputTab : cidTab)?.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tab.click();
      }
    });
  });
  document.getElementById('impInsert')?.addEventListener('click', onImportInsert);
  document.getElementById('addRow')?.addEventListener('click', addRow);
  document.getElementById('clearRows')?.addEventListener('click', clearRows);
  document.getElementById('csvExport')?.addEventListener('click', exportCSV);
  document.getElementById('csvImport')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importCSV(file);
    e.target.value = '';
  });
  document.getElementById('generate')?.addEventListener('click', onGenerate);
  document.getElementById('copyAll')?.addEventListener('click', onCopyAll);
  document.getElementById('urlsRefresh')?.addEventListener('click', renderUrlList);
  document.getElementById('urlsCopy')?.addEventListener('click', () => copyAllUrls());
  document.getElementById('urlsCsv')?.addEventListener('click', () => downloadUrls('csv'));
  document.getElementById('urlsTxt')?.addEventListener('click', () => downloadUrls('txt'));
  document.getElementById('saveAll')?.addEventListener('click', () => { saveAll(); flash('Saved!'); });
  document.getElementById('loadAll')?.addEventListener('click', () => {
    if (loadAll()) { renderAll(); flash('Loaded!'); } else { flash('Nothing to load'); }
  });
  document.getElementById('resetAll')?.addEventListener('click', () => {
    if (confirm('Reset all data?')) { resetAll(); renderAll(); flash('Reset!'); }
  });
  document.getElementById('template')?.addEventListener('input', (e) => {
    state.template = e.target.value;
  });
  document.getElementById('impKws')?.addEventListener('input', updateKeywordCount);
  document.getElementById('loadPreset')?.addEventListener('click', () => {
    const key = document.getElementById('tplPresets')?.value;
    const presets = getTemplatePresets();
    if (key && presets[key]) {
      state.template = presets[key];
      renderTemplateSection();
      flash(`Loaded preset: ${key}`);
    }
  });
}

function onTabChange(view) {
  state.view = view;

  // Update tab states
  const inputTab = document.getElementById('viewInput');
  const cidTab = document.getElementById('viewCid');

  if (inputTab && cidTab) {
    // Update visual states
    inputTab.classList.toggle('active', view === 'input');
    cidTab.classList.toggle('active', view === 'cid');

    // Update ARIA states
    inputTab.setAttribute('aria-selected', view === 'input');
    cidTab.setAttribute('aria-selected', view === 'cid');

    // Update tabindex for keyboard navigation
    inputTab.tabIndex = view === 'input' ? 0 : -1;
    cidTab.tabIndex = view === 'cid' ? 0 : -1;

    // Announce tab change to screen readers
    announceToScreenReader(`Switched to ${view === 'input' ? 'Input and Setup' : 'CID Search Results'} tab`);
  }

  renderAll();
}

// Screen reader announcements
function announceToScreenReader(message) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

function onImportInsert() {
  importKeywords();
}

function onGenerate() {
  const ol = document.getElementById('outputs');
  if (!ol) return;

  ol.innerHTML = '';
  const tpl = state.template || '';
  const total = state.rows.length;

  state.rows.forEach((row, idx) => {
    const data = computeRow(row, idx, total);
    const ctx = { ...data, rowIndex: idx, totalRows: total, now: new Date() };
    const text = renderTemplate(tpl, ctx);

    const li = document.createElement('li');
    const actions = document.createElement('div');
    actions.className = 'out-actions';

    const copy = document.createElement('button');
    copy.textContent = 'Copy';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        copy.textContent = 'Copied!';
        setTimeout(() => copy.textContent = 'Copy', 900);
      } catch {}
    });

    actions.appendChild(copy);
    const pre = document.createElement('pre');
    pre.textContent = text;
    li.append(actions, pre);
    ol.appendChild(li);
  });
}

function onCopyAll() {
  const total = state.rows.length;
  const texts = state.rows.map((r, i) => {
    const data = computeRow(r, i, total);
    const ctx = { ...data, rowIndex: i, totalRows: total, now: new Date() };
    return renderTemplate(state.template || '', ctx);
  });

  navigator.clipboard.writeText(texts.join('\n')).then(() => {
    flash('All results copied!');
  }).catch(() => {});
}

// Google Places Integration
let googleLoading = null;

function loadGooglePlaces(apiKey) {
  if (window.google?.maps?.places) return Promise.resolve();
  if (googleLoading) return googleLoading;

  googleLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load Google Maps JS'));
    script.onload = () => {
      if (window.google?.maps?.places) resolve();
      else reject(new Error('Google Places not available'));
    };
    document.head.appendChild(script);
  });

  return googleLoading;
}

function deriveCIDFromLocation(location) {
  return loadGooglePlaces(GOOGLE_API_KEY)
    .then(() => {
      if (!window.google?.maps?.places) throw new Error('Google Places not loaded');

      const service = new google.maps.places.PlacesService(document.createElement('div'));
      return findPlaceByText(service, location);
    })
    .then(place => {
      if (!place?.place_id) throw new Error('Place not found');

      const service = new google.maps.places.PlacesService(document.createElement('div'));
      return getPlaceDetails(service, place.place_id);
    })
    .then(details => {
      const cid = extractCIDFromUrl(details?.url);
      if (!cid) throw new Error('CID not found in place details');
      return cid;
    });
}

function findPlaceByText(service, query) {
  return new Promise((resolve, reject) => {
    const req = { query, fields: ['place_id', 'name', 'formatted_address'] };

    service.textSearch({ query }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
        resolve({ place_id: results[0].place_id });
      } else {
        service.findPlaceFromQuery(req, (res2, st2) => {
          if (st2 === google.maps.places.PlacesServiceStatus.OK && res2?.length) {
            resolve(res2[0]);
          } else {
            resolve(null);
          }
        });
      }
    });
  });
}

function getPlaceDetails(service, placeId) {
  return new Promise((resolve) => {
    service.getDetails(
      { placeId, fields: ['url', 'name', 'place_id'] },
      (res, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          resolve(res);
        } else {
          resolve(null);
        }
      }
    );
  });
}

function extractCIDFromUrl(url) {
  if (!url) return '';
  const m = url.match(/[?&]cid=(\d+)/);
  return m ? m[1] : '';
}

// Utility Functions
function flash(message, type = 'success') {
  const el = document.createElement('div');
  el.textContent = message;
  el.className = `flash flash-${type}`;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');

  document.body.appendChild(el);

  // Announce to screen readers
  announceToScreenReader(message);

  setTimeout(() => {
    el.remove();
  }, type === 'error' ? 4000 : 2000);
}

// Enhanced flash message types
function flashSuccess(message) {
  flash(message, 'success');
}

function flashError(message) {
  flash(message, 'error');
}

function flashWarning(message) {
  flash(message, 'warning');
}

function updateKeywordCount() {
  const el = document.getElementById('impKws');
  const out = document.getElementById('kwCount');
  if (!el || !out) return;

  const lines = String(el.value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const count = lines.length;

  out.textContent = `URLs to generate: ${count}`;

  // Update ARIA label for better screen reader experience
  out.setAttribute('aria-label', `${count} URLs will be generated from the entered keywords`);

  // Visual feedback for count
  out.className = `tiny ${count > 0 ? 'status-success' : ''}`;
}

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = before + text + after;
  const pos = start + text.length;
  textarea.selectionStart = textarea.selectionEnd = pos;
  textarea.dispatchEvent(new Event('input'));
}

function plusify(string) {
  return String(string || '').trim().replace(/\s+/g, '+');
}

function getTemplatePresets() {
  return {
    'Final URLs Only': '{{FinalUrl}}',
    'Keyword + Brand': 'Keyword: {{OriginalSearch}} | Brand: {{Brand}}',
    'Full Details': 'Brand: {{Brand}}\nKeyword: {{OriginalSearch}}\nLocation CID: {{LocationCID}}\nGMB CID: {{GMBCID}}\nFinal URL: {{FinalUrl}}',
    'Simple List': '{{OriginalSearch}} - {{FinalUrl}}'
  };
}

function copyAllUrls() {
  const total = state.rows.length;
  const urls = state.rows.map((r, i) => computeRow(r, i, total).FinalUrl || '');
  navigator.clipboard.writeText(urls.join('\n')).then(() => {
    flash('All URLs copied!');
  }).catch(() => {});
}

function downloadUrls(format) {
  const total = state.rows.length;
  const urls = state.rows.map((r, i) => computeRow(r, i, total).FinalUrl || '');

  if (format === 'csv') {
    const csv = CSV.stringify([['FinalUrl'], ...urls.map(u => [u])]);
    downloadBlob(csv, 'text/csv;charset=utf-8', 'cid-urls.csv');
  } else {
    const txt = urls.join('\n');
    downloadBlob(txt, 'text/plain;charset=utf-8', 'cid-urls.txt');
  }
}

// Initialize Application
function initApp() {
  loadAll();
  ensureDefaults();
  bindEvents();
  renderAll();
}

function ensureDefaults() {
  if (!state.columns || state.columns.length === 0) {
    state.columns = defaultColumns();
  }
  if (!state.rows || state.rows.length === 0) {
    state.rows = [
      {
        OriginalSearch: 'chicago roofers',
        Brand: 'Chicago Roofing Services Inc',
        LocationCID: '12673312613543755776',
        GMBCID: '8071969139480942171'
      }
    ];
  }
  if (!state.template || !String(state.template).trim()) {
    state.template = '{{FinalUrl}}';
  }
}

// Start the application
document.addEventListener('DOMContentLoaded', initApp);