// UI Rendering

/**
 * Master rendering function that updates all UI components
 * Coordinates the refresh of all visual elements when data changes
 *
 * @function renderAll
 * @returns {void}
 *
 * @example
 * // Called after any data modification
 * state.rows.push({OriginalSearch: 'new keyword'});
 * renderAll();
 *
 * @description Orchestrates a complete UI refresh by calling all
 * component-specific render functions in the correct order. Handles
 * view-specific visibility and ensures all displays reflect current
 * application state. Called automatically by most data modification
 * functions to maintain UI consistency.
 */
function renderAll() {
  renderColumns();
  renderTable();
  renderUrlList();
  renderTemplateSection();
  renderComposition();
  updateKeywordCount();

  // Show/hide panels based on current view
  const isInput = state.view === 'input';
  const urlsPanel = document.getElementById('urlsPanel');
  if (urlsPanel) {
    urlsPanel.style.display = isInput ? 'none' : '';
  }

  // Initialize dropdown menus
  initializeDropdowns();
}

/**
 * Renders the column configuration interface
 * Currently a placeholder for future column management UI
 *
 * @function renderColumns
 * @returns {void}
 *
 * @description Reserved for future implementation of dynamic column
 * configuration UI. Would handle rendering of column add/remove/edit
 * controls and column reordering interface.
 */
function renderColumns() {
  // This would render column configuration UI if needed
}

/**
 * Renders the main data table with input fields and computed values
 * Creates an interactive table for data entry and displays calculated results
 *
 * @function renderTable
 * @returns {void}
 *
 * @example
 * // Called automatically by renderAll()
 * renderTable();
 *
 * @description Builds a dynamic HTML table based on current view mode:
 *
 * Input View:
 * - Shows only input columns for data entry
 * - Creates editable input fields with live updates
 * - Provides row actions (delete, duplicate)
 *
 * CID View:
 * - Shows only the FinalUrl computed column
 * - Displays read-only computed results
 * - Still provides row management actions
 *
 * Features:
 * - Real-time formula recalculation on input changes
 * - Row-level actions for data management
 * - Responsive column visibility based on view mode
 * - Computed values are automatically updated
 */
function renderTable() {
  const tbl = document.getElementById('dataTable');
  if (!tbl) return;

  tbl.innerHTML = '';
  const thead = document.createElement('thead');
  const htr = document.createElement('tr');

  // Filter columns based on current view mode
  const visibleCols = state.columns.filter(c =>
    state.view === 'cid' ? c.name === 'FinalUrl' : c.kind === 'input'
  );

  // Create header row
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

  // Create data rows
  const tbody = document.createElement('tbody');
  const total = state.rows.length;

  state.rows.forEach((row, rIdx) => {
    const computed = computeRow(row, rIdx, total);
    const tr = document.createElement('tr');

    // Create cells for visible columns
    for (const col of visibleCols) {
      const td = document.createElement('td');

      if (col.kind === 'input') {
        // Create editable input field
        const inp = document.createElement('input');
        inp.className = 'cell';
        inp.value = row[col.name] ?? '';
        inp.addEventListener('input', () => {
          row[col.name] = inp.value;
          // Update URL preview immediately
          renderComposition();
        });
        td.appendChild(inp);
      } else {
        // Display computed value
        td.className = 'computed';
        td.textContent = computed[col.name] ?? '';
      }
      tr.appendChild(td);
    }

    // Create action buttons
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
      // Deep clone the row to avoid reference issues
      state.rows.splice(rIdx + 1, 0, JSON.parse(JSON.stringify(row)));
      renderAll();
    });

    tdAct.append(del, dup);
    tr.appendChild(tdAct);
    tbody.appendChild(tr);
  });

  tbl.appendChild(tbody);
}

/**
 * Renders the list of generated URLs in the CID Search Results panel
 * Creates clickable URL entries with copy-to-clipboard functionality
 *
 * @function renderUrlList
 * @returns {void}
 *
 * @example
 * // Called automatically by renderAll()
 * renderUrlList();
 *
 * @description Generates a formatted list of all computed FinalUrl values
 * with the following features:
 *
 * - Computes fresh URL values for all rows using current formulas
 * - Creates clickable list items for easy copying
 * - Implements one-click copy-to-clipboard for individual URLs
 * - Updates the URL count display
 * - Handles empty URLs gracefully
 *
 * Each URL is computed using the current row data and column formulas,
 * ensuring the list always reflects the latest changes. Click-to-copy
 * provides a smooth user experience for URL collection.
 */
function renderUrlList() {
  const list = document.getElementById('urlList');
  if (!list) return;

  list.innerHTML = '';
  const total = state.rows.length;

  // Generate URLs using current data and formulas
  const urls = state.rows.map((r, i) => computeRow(r, i, total).FinalUrl || '');

  // Create clickable list items with copy functionality
  urls.forEach((url, idx) => {
    const li = document.createElement('li');
    li.textContent = url;
    li.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        flash('URL copied!');
      } catch {
        // Clipboard API might not be available in some contexts
        // Fail silently to avoid user confusion
      }
    });
    list.appendChild(li);
  });

  // Update URL count display
  const counter = document.getElementById('urlsCount');
  if (counter) counter.textContent = `(${urls.length})`;
}

/**
 * Renders the template configuration section with presets
 * Updates the template textarea and populates the preset dropdown
 *
 * @function renderTemplateSection
 * @returns {void}
 *
 * @example
 * // Called automatically by renderAll()
 * renderTemplateSection();
 *
 * @description Synchronizes the template section UI with current state:
 *
 * - Updates template textarea with current template value
 * - Populates preset dropdown with available template options
 * - Maintains preset selection state across renders
 *
 * The template system allows users to customize output formatting
 * using {{variable}} syntax with formula evaluation. Presets provide
 * common formatting patterns for quick setup.
 */
function renderTemplateSection() {
  // Update template textarea with current value
  const ta = document.getElementById('template');
  if (ta) ta.value = state.template || '';

  // Populate preset dropdown
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

/**
 * Displays a temporary flash message with accessibility support
 * Shows user feedback for actions with automatic dismissal
 *
 * @function flash
 * @param {string} message - Message text to display
 * @param {string} [type='success'] - Message type: 'success', 'error', 'warning'
 * @returns {void}
 *
 * @example
 * // Show success message
 * flash('Data saved successfully!');
 *
 * // Show error message
 * flash('Invalid input detected', 'error');
 *
 * // Show warning message
 * flash('This action cannot be undone', 'warning');
 *
 * @description Creates a styled notification that:
 * - Appears in the bottom-right corner
 * - Auto-dismisses after 2-4 seconds (longer for errors)
 * - Includes proper ARIA attributes for screen readers
 * - Announces content to assistive technology
 * - Uses color coding for different message types
 *
 * Essential for providing user feedback on form submissions,
 * data operations, and validation errors.
 */
function flash(message, type = 'success') {
  const el = document.createElement('div');
  el.textContent = message;
  el.className = `flash flash-${type}`;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');

  document.body.appendChild(el);

  // Announce to screen readers for accessibility
  announceToScreenReader(message);

  // Auto-dismiss with longer delay for errors
  setTimeout(() => {
    el.remove();
  }, type === 'error' ? 4000 : 2000);
}

// Enhanced flash message types
/**
 * Displays a success flash message.
 * @param {string} message The message to display.
 */
function flashSuccess(message) {
  flash(message, 'success');
}

/**
 * Displays an error flash message.
 * @param {string} message The message to display.
 */
function flashError(message) {
  flash(message, 'error');
}

/**
 * Displays a warning flash message.
 * @param {string} message The message to display.
 */
function flashWarning(message) {
  flash(message, 'warning');
}

/**
 * Updates the keyword count display in real-time
 * Provides immediate feedback on how many URLs will be generated
 *
 * @function updateKeywordCount
 * @returns {void}
 *
 * @example
 * // Called automatically on textarea input events
 * updateKeywordCount();
 *
 * @description Analyzes the keyword textarea content and:
 * - Counts non-empty lines as individual keywords
 * - Updates the count display with current total
 * - Provides accessibility labels for screen readers
 * - Adds visual styling based on count status
 *
 * Helps users understand the scope of their bulk import operation
 * before executing the URL generation process.
 */
function updateKeywordCount() {
  const el = document.getElementById('impKws');
  const count = el ? el.value.split(/\r?\n/).filter(Boolean).length : 0;
  const display = document.getElementById('keywordCount');
  if (display) {
    display.textContent = `${count} keyword(s)`;
  }
}

/**
 * Renders a visual composition preview of the generated URL structure.
 * Shows a color-coded breakdown of the URL using the first data row.
 */
function renderComposition() {
  const host = document.getElementById('compositionUrl');
  if (!host) return;

  host.innerHTML = '';
  if (!state.rows.length) {
    host.textContent = 'No data to preview';
    return;
  }

  // Use first row as representative example
  const total = state.rows.length;
  const row = computeRow(state.rows[0], 0, total);
  const parts = buildURLParts(row);
  const frag = document.createDocumentFragment();

  // Create color-coded spans for each URL segment
  parts.forEach(p => {
    const span = document.createElement('span');
    span.className = 'seg seg-' + (p.k === 'const' ? 'const' : p.k);
    span.textContent = p.t;
    frag.appendChild(span);
  });

  host.appendChild(frag);
}
