// Event Handlers

/**
 * Binds all event listeners for the application
 * Sets up interactive behaviors and keyboard navigation
 *
 * @function bindEvents
 * @returns {void}
 *
 * @description Establishes event listeners for:
 * - Tab navigation with keyboard support (arrow keys, enter, space)
 * - Form submissions and button clicks
 * - File import/export operations
 * - Template management and preset loading
 * - Data management operations (add/clear rows)
 * - URL generation and copying functionality
 *
 * Includes accessibility features like keyboard navigation
 * and screen reader announcements for better UX.
 */
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
  // Unified export system - will be handled by new dropdown
  window.exportData = exportData;
  document.getElementById('csvImport')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importCSV(file);
    e.target.value = '';
  });
  document.getElementById('generate')?.addEventListener('click', onGenerate);
  document.getElementById('copyAll')?.addEventListener('click', onCopyAll);
  // Removed refresh button - URLs auto-update
  document.getElementById('urlsCopy')?.addEventListener('click', () => copyAllUrls());
  // Export buttons moved to dropdown menu
  window.downloadUrls = downloadUrls;
  document.getElementById('saveAll')?.addEventListener('click', () => { saveAll(); flash('Saved!'); });
  document.getElementById('loadAll')?.addEventListener('click', () => {
    if (loadAll()) { renderAll(); flash('Loaded successfully!'); } else { flash('Nothing to load'); }
  });
  document.getElementById('resetAll')?.addEventListener('click', () => {
    if (confirm('Reset all data? This action cannot be undone.')) {
      resetAll();
      renderAll();
      flash('Data reset to defaults');
    }
  });
  document.getElementById('apiKeySave')?.addEventListener('click', onApiKeySave);
  document.getElementById('apiKeyClear')?.addEventListener('click', onApiKeyClear);
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

/**
 * Handles tab switching between input and CID views
 * Updates UI state and accessibility attributes
 *
 * @function onTabChange
 * @param {string} view - Target view: 'input' or 'cid'
 * @returns {void}
 *
 * @example
 * // Switch to CID results view
 * onTabChange('cid');
 *
 * @description Manages the application's dual-view interface:
 *
 * Input View:
 * - Shows data entry forms and table with input columns
 * - Hides URL results panel
 * - Focuses on data collection and setup
 *
 * CID View:
 * - Shows generated URLs and results
 * - Displays final URL column in table
 * - Focuses on output and results
 *
 * Accessibility Features:
 * - Updates ARIA attributes for screen readers
 * - Manages keyboard focus and tabindex
 * - Announces view changes to assistive technology
 */
function onTabChange(view) {
  state.view = view;

  // Update tab states
  const inputTab = document.getElementById('viewInput');
  const cidTab = document.getElementById('viewCid');

  if (inputTab && cidTab) {
    // Update visual states
    inputTab.classList.toggle('active', view === 'input');
    cidTab.classList.toggle('active', view === 'cid');

    // Update ARIA states for accessibility
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

/**
 * Announces a message to screen readers for accessibility.
 * @param {string} message The message to announce.
 */
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

/**
 * Event handler for the import button.
 */
function onImportInsert() {
  importKeywords();
}

/**
 * Event handler for the generate button.
 */
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

/**
 * Event handler for the copy all button.
 */
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
