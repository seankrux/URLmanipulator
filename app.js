// Storage and Configuration
const STORAGE_KEY = 'cid-generator-v1';
const GOOGLE_API_KEY_STORAGE = 'cid-generator-google-api';
const KWS_API_KEY_STORAGE = 'cid-generator-kws-api';
const KWS_API_BASE_URL = 'https://api.keywordseverywhere.com/v1/';
const APP_CACHE_VERSION = (typeof window !== 'undefined' && window.APP_CACHE_VERSION) || 'v2024-09-26';

// API Configuration
const DEFAULT_GOOGLE_API_KEY = '';
const DEFAULT_KWS_API_KEY = '';
let googleApiKey = DEFAULT_GOOGLE_API_KEY; // In-memory Google Maps API key cache
let kwsApiKey = DEFAULT_KWS_API_KEY; // In-memory Keywords Everywhere API key cache

/**
 * Persists the current application state to browser localStorage
 * Saves columns configuration, data rows, and template settings for session recovery
 *
 * @function saveAll
 * @returns {void}
 *
 * @example
 * // Save current state before major changes
 * saveAll();
 *
 * @description This function ensures data persistence across browser sessions.
 * It serializes the current state including column definitions, user data rows,
 * and template configuration to localStorage using JSON serialization.
 */
function saveAll() {
  const toStore = {
    columns: state.columns,
    rows: state.rows,
    template: state.template
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

/**
 * Restores application state from browser localStorage
 * Attempts to load previously saved columns, rows, and template configuration
 *
 * @function loadAll
 * @returns {boolean} true if data was successfully loaded, false if no data exists or parsing failed
 *
 * @example
 * // Restore previous session on app initialization
 * if (loadAll()) {
 *   console.log('Previous session restored');
 * } else {
 *   console.log('No previous session found');
 * }
 *
 * @description Safely attempts to parse stored JSON data and validate types
 * before restoring to application state. Gracefully handles corrupted data
 * by returning false without throwing errors.
 */
function loadAll() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    // Validate data types before restoration to prevent corruption
    if (Array.isArray(data.columns)) state.columns = data.columns;
    if (Array.isArray(data.rows)) state.rows = data.rows;
    if (typeof data.template === 'string') state.template = data.template;
    return true;
  } catch { return false; }
}

/**
 * Resets the application to default state and clears all stored data
 * Removes localStorage data and reinitializes with default configuration
 *
 * @function resetAll
 * @returns {void}
 *
 * @example
 * // Reset after user confirmation
 * if (confirm('Reset all data?')) {
 *   resetAll();
 *   renderAll();
 * }
 *
 * @description This is a destructive operation that cannot be undone.
 * It clears all user data, resets columns to defaults, and restores
 * the default template configuration.
 */
function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  state.columns = defaultColumns();
  state.rows = [];
  state.template = '{{FinalUrl}}';
}

/**
 * Removes any residual service workers to avoid stale asset caching
 */
function purgeServiceWorkers() {
  try {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations()
      .then(registrations => registrations.forEach(reg => reg.unregister()))
      .catch(() => {});
  } catch {}
}

/**
 * Records the current app build version to help invalidate stale caches
 */
function recordAppVersionStamp() {
  try {
    const key = 'cid-generator-cache-version';
    const previous = localStorage.getItem(key);
    if (previous && previous !== APP_CACHE_VERSION) {
      flash('App updated to the latest build.', 'success');
    }
    localStorage.setItem(key, APP_CACHE_VERSION);
  } catch {}
}

// Google Places API configuration management

function chromeStorageAvailable() {
  try {
    return typeof chrome !== 'undefined' && !!chrome.storage?.sync;
  } catch {
    return false;
  }
}

function setGoogleApiKey(value) {
  googleApiKey = String(value || '').trim();
}

function getGoogleApiKey() {
  if (googleApiKey) return googleApiKey;
  const fallback = window.cidAppConfig?.googleApiKey;
  if (fallback) setGoogleApiKey(fallback);
  return googleApiKey;
}

function loadGoogleApiKeyFromStorage() {
  return new Promise((resolve) => {
    const fallback = () => {
      try {
        const localValue = localStorage.getItem(GOOGLE_API_KEY_STORAGE) || '';
        resolve(localValue.trim());
      } catch {
        resolve('');
      }
    };

    if (!chromeStorageAvailable()) {
      fallback();
      return;
    }

    try {
      chrome.storage.sync.get([GOOGLE_API_KEY_STORAGE], (items) => {
        if (chrome.runtime?.lastError) {
          fallback();
          return;
        }

        const value = items?.[GOOGLE_API_KEY_STORAGE];
        if (typeof value === 'string' && value.trim()) resolve(value.trim());
        else fallback();
      });
    } catch {
      fallback();
    }
  });
}

function persistGoogleApiKey(value) {
  const sanitized = String(value || '').trim();
  setGoogleApiKey(sanitized);

  try {
    if (sanitized) localStorage.setItem(GOOGLE_API_KEY_STORAGE, sanitized);
    else localStorage.removeItem(GOOGLE_API_KEY_STORAGE);
  } catch {}

  if (!chromeStorageAvailable()) return Promise.resolve(sanitized);

  return new Promise((resolve) => {
    try {
      chrome.storage.sync.set({ [GOOGLE_API_KEY_STORAGE]: sanitized }, () => {
        resolve(sanitized);
      });
    } catch {
      resolve(sanitized);
    }
  });
}

function clearGoogleApiKey() {
  setGoogleApiKey('');
  try { localStorage.removeItem(GOOGLE_API_KEY_STORAGE); } catch {}

  const fallback = () => {
    setGoogleApiKey(window.cidAppConfig?.googleApiKey || '');
    return getGoogleApiKey();
  };

  if (!chromeStorageAvailable()) return Promise.resolve(fallback());

  return new Promise((resolve) => {
    try {
      chrome.storage.sync.remove(GOOGLE_API_KEY_STORAGE, () => {
        if (chrome.runtime?.lastError) {
          resolve(fallback());
          return;
        }
        resolve(fallback());
      });
    } catch {
      resolve(fallback());
    }
  });
}

function updateApiKeyStatus(message, tone = 'info') {
  const statusEl = document.getElementById('apiKeyStatus');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.add('status-indicator');

  const toneClasses = ['status-success', 'status-error', 'status-warning'];
  toneClasses.forEach(cls => statusEl.classList.remove(cls));

  if (tone === 'success' || tone === 'error' || tone === 'warning') {
    statusEl.classList.add(`status-${tone}`);
  }
}

function updateMapsApiStatus(message, tone = 'info') {
  const statusEl = document.getElementById('mapsApiStatus');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.add('status-indicator');

  const toneClasses = ['status-success', 'status-error', 'status-warning'];
  toneClasses.forEach(cls => statusEl.classList.remove(cls));

  if (tone === 'success' || tone === 'error' || tone === 'warning') {
    statusEl.classList.add(`status-${tone}`);
  }
}

function applyMaskedKeyToInput(input, {
  storedValue = '',
  defaultValue = '',
  placeholderWhenDefault = '',
  placeholderWhenEmpty = '',
  maskedTitle = ''
} = {}) {
  if (!input) return { masked: false, state: 'missing-input' };

  input.dataset.maskState = 'uninitialized';
  input.style.fontFamily = '';
  input.style.color = '';
  input.title = '';

  if (!storedValue) {
    if (placeholderWhenEmpty) input.placeholder = placeholderWhenEmpty;
    input.value = '';
    input.dataset.maskState = 'empty';
    return { masked: false, state: 'empty' };
  }

  if (storedValue === defaultValue) {
    if (placeholderWhenDefault) input.placeholder = placeholderWhenDefault;
    input.value = '';
    input.style.color = '#999';
    input.dataset.maskState = 'default';
    return { masked: false, state: 'default' };
  }

  input.value = '••••••••••••••••••••••••••••••••••••••••' + storedValue.slice(-4);
  input.style.fontFamily = 'monospace';
  input.style.color = '#666';
  if (maskedTitle) input.title = maskedTitle;
  input.dataset.maskState = 'masked';
  return { masked: true, state: 'masked' };
}

function initializeApiKeySettings() {
  updateApiKeyStatus('Checking saved key...');
  loadGoogleApiKeyFromStorage()
    .then((stored) => {
      const input = document.getElementById('apiKeyInput');

      if (stored) {
        setGoogleApiKey(stored);
        const maskResult = applyMaskedKeyToInput(input, {
          storedValue: stored,
          defaultValue: DEFAULT_GOOGLE_API_KEY,
          placeholderWhenDefault: 'Paste your key (optional)',
          placeholderWhenEmpty: 'Paste your key (optional)',
          maskedTitle: 'Stored API key (click to modify)'
        });
        console.info('[MaskCheck] Google API input state:', maskResult.state);

        if (maskResult.state === 'masked') {
          updateApiKeyStatus('API key saved securely (mask verified).', 'success');
        } else if (maskResult.state === 'default') {
          updateApiKeyStatus('API key stored for this browser.', 'success');
        } else if (maskResult.state === 'missing-input') {
          updateApiKeyStatus('API key saved but input field missing in DOM.', 'warning');
        } else {
          updateApiKeyStatus('API key ready for CID lookup.', 'success');
        }
      } else if (window.cidAppConfig?.googleApiKey) {
        const configKey = window.cidAppConfig.googleApiKey;
        setGoogleApiKey(configKey);
        const maskResult = applyMaskedKeyToInput(input, {
          storedValue: configKey,
          defaultValue: DEFAULT_GOOGLE_API_KEY,
          placeholderWhenDefault: 'Paste your key (optional)',
          placeholderWhenEmpty: 'Paste your key (optional)',
          maskedTitle: 'Stored API key (click to modify)'
        });
        console.info('[MaskCheck] Google API config state:', maskResult.state);
        updateApiKeyStatus('Using API key from configuration file.', 'success');
      } else {
        const maskResult = applyMaskedKeyToInput(input, {
          storedValue: '',
          defaultValue: DEFAULT_GOOGLE_API_KEY,
          placeholderWhenEmpty: 'Paste your key (optional)'
        });
        console.info('[MaskCheck] Google API input state:', maskResult.state);
        updateApiKeyStatus('CID lookup inactive until a key is saved.', 'warning');
      }
    })
    .catch(() => {
      updateApiKeyStatus('Unable to read saved key. Save it again if needed.', 'error');
    });
}

/**
 * Initializes Keywords Everywhere API settings on startup
 */
function initializeKwsApiSettings() {
  updateKwsApiStatus('Loading KWS API configuration...');
  loadKwsApiKeyFromStorage()
    .then((stored) => {
      const input = document.getElementById('kwsApiKeyInput');

      if (stored) {
        // Show masked key in input field when a key is stored
        const maskResult = applyMaskedKeyToInput(input, {
          storedValue: stored,
          defaultValue: DEFAULT_KWS_API_KEY,
          placeholderWhenDefault: 'Your Keywords Everywhere API key',
          placeholderWhenEmpty: 'Your Keywords Everywhere API key',
          maskedTitle: 'Stored KWS API key (click to modify)'
        });
        console.info('[MaskCheck] KWS API input state:', maskResult.state);

        if (maskResult.state === 'masked') {
          updateKwsApiStatus('KWS API key saved securely (mask verified).', 'success');
        } else if (maskResult.state === 'default') {
          updateKwsApiStatus('KWS API key stored for this browser.', 'success');
        } else if (maskResult.state === 'missing-input') {
          updateKwsApiStatus('KWS API key saved but input field missing in DOM.', 'warning');
        } else {
          updateKwsApiStatus('KWS API ready for keyword enrichment', 'success');
        }
      } else {
        const maskResult = applyMaskedKeyToInput(input, {
          storedValue: '',
          defaultValue: DEFAULT_KWS_API_KEY,
          placeholderWhenEmpty: 'Your Keywords Everywhere API key'
        });
        console.info('[MaskCheck] KWS API input state:', maskResult.state);
        updateKwsApiStatus('KWS API inactive until a key is saved.', 'warning');
      }
    })
    .catch(() => {
      updateKwsApiStatus('Unable to load KWS API configuration', 'error');
    });
}

function onApiKeySave(event) {
  event?.preventDefault();
  const input = document.getElementById('apiKeyInput');
  if (!input) return;

  const value = input.value.trim();
  if (!value) {
    flash('Enter an API key before saving.', 'warning');
    return;
  }

  persistGoogleApiKey(value)
    .then(() => {
      setGoogleApiKey(value);
      const maskResult = applyMaskedKeyToInput(input, {
        storedValue: value,
        defaultValue: DEFAULT_GOOGLE_API_KEY,
        placeholderWhenDefault: 'Paste your key (optional)',
        placeholderWhenEmpty: 'Paste your key (optional)',
        maskedTitle: 'Stored API key (click to modify)'
      });
      console.info('[MaskCheck] Google API input state:', maskResult.state);
      let statusMessage = 'API key saved locally.';
      let tone = 'success';

      if (maskResult.state === 'masked') {
        statusMessage = 'API key saved securely (mask verified).';
        tone = 'success';
      } else if (maskResult.state === 'default') {
        statusMessage = 'API key stored for this browser.';
        tone = 'success';
      } else if (maskResult.state === 'missing-input') {
        statusMessage = 'API key saved but input field missing in DOM.';
        tone = 'warning';
      }

      updateApiKeyStatus(statusMessage, tone);
      flash('Google API key saved');
    })
    .catch(() => {
      updateApiKeyStatus('Unable to save API key.', 'error');
      flash('Failed to save API key', 'error');
    });
}

function onApiKeyClear(event) {
  event?.preventDefault();
  clearGoogleApiKey()
    .then((current) => {
      const input = document.getElementById('apiKeyInput');
      const maskResult = applyMaskedKeyToInput(input, {
        storedValue: current,
        defaultValue: DEFAULT_GOOGLE_API_KEY,
        placeholderWhenDefault: 'Paste your key (optional)',
        placeholderWhenEmpty: 'Paste your key (optional)',
        maskedTitle: 'Stored API key (click to modify)'
      });
      console.info('[MaskCheck] Google API input state after clear:', maskResult.state);
      if (current) updateApiKeyStatus('Using configuration-supplied key.', 'success');
      else updateApiKeyStatus('API key cleared. CID lookup disabled.', 'warning');
      flash('API key cleared', 'warning');
    })
    .catch(() => {
      updateApiKeyStatus('Unable to clear API key.', 'error');
      flash('Failed to clear API key', 'error');
    });
}

// Keywords Everywhere API Management

/**
 * Loads Keywords Everywhere API key from storage
 * Attempts chrome.storage.sync first, falls back to localStorage
 */
function loadKwsApiKeyFromStorage() {
  return new Promise((resolve) => {
    if (!chromeStorageAvailable()) {
      const localValue = localStorage.getItem(KWS_API_KEY_STORAGE) || '';
      kwsApiKey = localValue || kwsApiKey; // Use default if no stored value
      resolve(kwsApiKey);
      return;
    }

    chrome.storage.sync.get([KWS_API_KEY_STORAGE], (items) => {
      if (chrome.runtime.lastError) {
        const fallback = localStorage.getItem(KWS_API_KEY_STORAGE) || kwsApiKey;
        kwsApiKey = fallback;
        resolve(kwsApiKey);
        return;
      }

      const value = items?.[KWS_API_KEY_STORAGE];
      kwsApiKey = value || kwsApiKey; // Use default if no stored value
      resolve(kwsApiKey);
    });
  });
}

/**
 * Saves Keywords Everywhere API key to secure storage
 * @param {string} key - The API key to save
 */
function saveKwsApiKey(key) {
  const sanitized = String(key || '').trim();
  kwsApiKey = sanitized || DEFAULT_KWS_API_KEY;

  // Store in localStorage
  if (sanitized) localStorage.setItem(KWS_API_KEY_STORAGE, sanitized);
  else localStorage.removeItem(KWS_API_KEY_STORAGE);

  // Store in chrome.storage.sync if available
  if (!chromeStorageAvailable()) return Promise.resolve(sanitized);

  return new Promise((resolve) => {
    chrome.storage.sync.set({ [KWS_API_KEY_STORAGE]: sanitized }, () => {
      if (chrome.runtime.lastError) {
        console.warn('Chrome storage failed, using localStorage only');
      }
      kwsApiKey = sanitized || DEFAULT_KWS_API_KEY;
      resolve(sanitized);
    });
  });
}

/**
 * Clears Keywords Everywhere API key from all storage
 */
function clearKwsApiKey() {
  try { localStorage.removeItem(KWS_API_KEY_STORAGE); } catch {}

  const fallback = () => {
    kwsApiKey = DEFAULT_KWS_API_KEY;
    return DEFAULT_KWS_API_KEY;
  };

  if (!chromeStorageAvailable()) return Promise.resolve(fallback());

  return new Promise((resolve) => {
    chrome.storage.sync.remove(KWS_API_KEY_STORAGE, () => {
      if (chrome.runtime.lastError) {
        console.warn('Chrome storage clear failed');
      }
      const value = fallback();
      resolve(value);
    });
  });
}

/**
 * Gets the current Keywords Everywhere API key
 * @returns {string} Current API key
 */
function getKwsApiKey() {
  return kwsApiKey || DEFAULT_KWS_API_KEY;
}

/**
 * Updates the KWS API status display
 * @param {string} message - Status message to display
 */
function updateKwsApiStatus(message, tone) {
  const statusEl = document.getElementById('kwsApiStatus');
  if (!statusEl) return;

  const resolvedTone = tone || (getKwsApiKey() ? 'success' : 'warning');
  statusEl.textContent = message;
  statusEl.classList.add('status-indicator');
  ['status-success', 'status-error', 'status-warning'].forEach(cls => statusEl.classList.remove(cls));
  if (resolvedTone) statusEl.classList.add(`status-${resolvedTone}`);
}

/**
 * Fetches keyword data from Keywords Everywhere API
 * @param {Array<string>} keywords - Array of keywords to analyze (max 100)
 * @returns {Promise<Object>} API response with keyword data
 */
async function getKeywordData(keywords) {
  const apiKey = getKwsApiKey();
  if (!apiKey) {
    throw new Error('Keywords Everywhere API key not configured');
  }

  const keywordList = keywords.slice(0, 100); // API limit

  try {
    const response = await fetch(`${KWS_API_BASE_URL}get_keyword_data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        keywords: keywordList,
        dataSource: 'gkp', // Google Keyword Planner
        country: 'US',
        currency: 'USD'
      })
    });

    if (!response.ok) {
      throw new Error(`Keywords Everywhere API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Keywords Everywhere API error:', error);
    throw error;
  }
}

/**
 * Gets related keywords for a given search term
 * @param {string} keyword - Base keyword to find related terms for
 * @returns {Promise<Object>} Related keywords data
 */
async function getRelatedKeywords(keyword) {
  const apiKey = getKwsApiKey();
  if (!apiKey) {
    throw new Error('Keywords Everywhere API key not configured');
  }

  try {
    const response = await fetch(`${KWS_API_BASE_URL}get_related_keywords`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        keyword: keyword,
        country: 'US'
      })
    });

    if (!response.ok) {
      throw new Error(`Keywords Everywhere API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Related keywords API error:', error);
    throw error;
  }
}

/**
 * Enriches existing keywords with search volume, CPC, and competition data
 * @param {Array<string>} keywords - Keywords to enrich
 * @returns {Promise<Array<Object>>} Enriched keyword data
 */
async function enrichKeywordsWithData(keywords) {
  try {
    updateKwsApiStatus('Fetching keyword data...');
    const data = await getKeywordData(keywords);
    updateKwsApiStatus('Keywords enriched successfully');
    return data;
  } catch (error) {
    updateKwsApiStatus('Failed to enrich keywords');
    throw error;
  }
}

// Column Management

/**
 * Returns the default column configuration for the CID Generator Tool
 * Defines the standard set of columns with input fields and computed formulas
 *
 * @function defaultColumns
 * @returns {Array<Object>} Array of column configuration objects
 * @returns {string} returns[].name - Unique column identifier
 * @returns {string} returns[].label - Human-readable column label
 * @returns {string} returns[].kind - Column type: 'input' or 'computed'
 * @returns {string} [returns[].formula] - Formula for computed columns
 *
 * @example
 * // Initialize with default columns
 * state.columns = defaultColumns();
 *
 * @description Provides the standard column structure for CID URL generation:
 * - OriginalSearch: User input for search keywords
 * - Brand: Google My Business brand name
 * - LocationCID: Geographic location identifier
 * - GMBCID: Google My Business customer ID
 * - SearchBase: Computed URL template
 * - FinalUrl: Final computed URL with all substitutions
 */
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

/**
 * Adds a new column to the application configuration
 * Creates either input or computed columns based on user specification
 *
 * @function addColumn
 * @returns {void}
 *
 * @example
 * // User fills form and clicks "Add Column"
 * addColumn(); // Reads from DOM elements
 *
 * @description Validates column name uniqueness, creates column object,
 * and updates the UI. For computed columns, stores the provided formula.
 * Prevents duplicate column names and clears input fields after creation.
 *
 * @throws {void} Shows flash message for validation errors
 */
function addColumn() {
  const name = document.getElementById('newColName')?.value.trim();
  const kind = document.getElementById('newColKind')?.value;
  const formula = document.getElementById('newColFormula')?.value;

  if (!name) return;

  // Check for duplicate column names
  const exists = state.columns.some(c => c.name === name);
  if (exists) {
    flash('Column already exists');
    return;
  }

  const col = { name, kind };
  if (kind === 'computed') col.formula = formula || '';
  state.columns.push(col);

  // Clear input fields after successful addition
  if (document.getElementById('newColName')) document.getElementById('newColName').value = '';
  if (document.getElementById('newColFormula')) document.getElementById('newColFormula').value = '';

  renderAll();
}

/**
 * Removes a column from the configuration and cleans up associated data
 * Deletes the column and removes its data from all existing rows
 *
 * @function removeColumn
 * @param {number} index - Zero-based index of the column to remove
 * @returns {void}
 *
 * @example
 * // Remove the third column (index 2)
 * removeColumn(2);
 *
 * @description Performs a complete cleanup by removing the column definition
 * and deleting the corresponding property from all data rows to prevent
 * orphaned data. Updates the UI after removal.
 */
function removeColumn(index) {
  const col = state.columns[index];
  state.columns.splice(index, 1);

  // Clean up column data from all rows
  for (const r of state.rows) delete r[col.name];

  renderAll();
}

/**
 * Reorders columns by moving them up or down in the display sequence
 * Enables users to customize column layout and data entry flow
 *
 * @function moveColumn
 * @param {number} index - Zero-based index of the column to move
 * @param {string} direction - Movement direction: 'up' or 'down'
 * @returns {void}
 *
 * @example
 * // Move the second column up one position
 * moveColumn(1, 'up');
 *
 * // Move the first column down one position
 * moveColumn(0, 'down');
 *
 * @description Validates movement boundaries to prevent invalid operations.
 * Updates the UI immediately after reordering to reflect changes.
 */
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

/**
 * Global application state object
 * Centralizes all application data and configuration
 *
 * @type {Object}
 * @property {string} view - Current view mode: 'input' or 'cid'
 * @property {Array<Object>} columns - Column configuration array
 * @property {Array<Object>} rows - Data rows with user input and computed values
 * @property {string} template - Output template for result generation
 */
const state = {
  view: 'input',
  columns: [],
  rows: [],
  template: '{{FinalUrl}}'
};

/**
 * Adds a new empty row to the data table
 * Creates a blank row object and triggers UI refresh
 *
 * @function addRow
 * @returns {void}
 *
 * @example
 * // User clicks "Add Row" button
 * addRow();
 *
 * @description Appends an empty object to the rows array, which will be
 * populated by user input. All computed columns will be automatically
 * calculated when the row is rendered.
 */
function addRow() {
  state.rows.push({});
  renderAll();
}

/**
 * Removes all data rows from the table
 * Clears the rows array and updates the display
 *
 * @function clearRows
 * @returns {void}
 *
 * @example
 * // User clicks "Clear All" after confirmation
 * if (confirm('Clear all data?')) {
 *   clearRows();
 * }
 *
 * @description This is a destructive operation that removes all user-entered
 * data while preserving column configuration. Cannot be undone.
 */
function clearRows() {
  state.rows = [];
  renderAll();
}

/**
 * Computes all calculated values for a single data row
 * Processes formulas and generates derived values using the formula engine
 *
 * @function computeRow
 * @param {Object} row - Source data row with input values
 * @param {number} index - Zero-based row index for context
 * @param {number} total - Total number of rows for context
 * @returns {Object} Complete row object with computed values
 *
 * @example
 * // Compute values for the first row
 * const computed = computeRow(state.rows[0], 0, state.rows.length);
 * console.log(computed.FinalUrl); // Generated URL
 *
 * @description Creates an enhanced context object with row metadata and
 * evaluates all computed column formulas. Errors in formula evaluation
 * are captured and displayed with [[ERR: ...]] formatting for debugging.
 * The context includes rowIndex, totalRows, and current timestamp.
 */
function computeRow(row, index, total) {
  // Create enhanced context with metadata for formula evaluation
  const ctxBase = { ...row, rowIndex: index, totalRows: total, now: new Date() };
  const out = { ...row };

  // Process each computed column with error handling
  for (const col of state.columns) {
    if (col.kind === 'computed') {
      try {
        out[col.name] = evaluateFormula(col.formula || '', ctxBase);
      } catch (e) {
        // Capture formula errors for debugging without breaking the application
        out[col.name] = `[[ERR: ${e.message}]]`;
      }
    }
  }
  return out;
}

// Formula Engine

/**
 * Built-in formula functions available for computed columns
 * Provides string manipulation and utility functions for URL generation
 *
 * @type {Object<string, Function>}
 * @property {Function} concat - Concatenates multiple values into a single string
 * @property {Function} upper - Converts string to uppercase
 * @property {Function} lower - Converts string to lowercase
 * @property {Function} trim - Removes whitespace from string edges
 * @property {Function} replace - Replaces all occurrences of substring
 * @property {Function} default - Returns fallback value if input is null/empty
 */
const formulaFunctions = {
  concat: (...args) => args.map(x => String(x ?? '')).join(''),
  upper: (s) => String(s ?? '').toUpperCase(),
  lower: (s) => String(s ?? '').toLowerCase(),
  trim: (s) => String(s ?? '').trim(),
  replace: (s, a, b) => String(s ?? '').split(String(a ?? '')).join(String(b ?? '')),
  default: (v, fb) => (v == null || v === '') ? fb : v
};

/**
 * Evaluates a formula expression with the given context variables
 * Supports string literals, function calls, and variable references
 *
 * @function evaluateFormula
 * @param {string} formula - The formula expression to evaluate
 * @param {Object} context - Variable context for formula evaluation
 * @param {string} [context.Brand] - Brand name for URL generation
 * @param {string} [context.OriginalSearch] - Original search keyword
 * @param {string} [context.LocationCID] - Location Customer ID
 * @param {string} [context.GMBCID] - Google My Business Customer ID
 * @param {number} [context.rowIndex] - Current row index (0-based)
 * @param {number} [context.totalRows] - Total number of rows
 * @param {Date} [context.now] - Current timestamp
 * @returns {string|number} The evaluated result of the formula
 * @throws {Error} When formula syntax is invalid or function is unknown
 *
 * @example
 * // String literal
 * evaluateFormula('"Hello World"', {}) // Returns: "Hello World"
 *
 * @example
 * // Function call with variables
 * evaluateFormula('concat(Brand, " - ", OriginalSearch)', {
 *   Brand: "Acme Corp",
 *   OriginalSearch: "roofing services"
 * }) // Returns: "Acme Corp - roofing services"
 *
 * @example
 * // Variable reference
 * evaluateFormula('Brand', { Brand: "Acme Corp" }) // Returns: "Acme Corp"
 *
 * @description Supports three types of expressions:
 * 1. String literals: Quoted strings with escaped quotes
 * 2. Function calls: Built-in functions with parentheses and arguments
 * 3. Variable references: Direct access to context properties
 */
function evaluateFormula(formula, context) {
  if (!formula) return '';
  const s = formula.trim();

  // String literal with quote escaping support
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/""/g, '"');
  }

  // Function call parsing with argument evaluation
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

  // Variable/identifier lookup in context
  return context[s];
}

/**
 * Renders a template string by replacing placeholders with formula results
 * Processes {{formula}} syntax and evaluates each formula with the given context
 *
 * @function renderTemplate
 * @param {string} template - Template string with {{formula}} placeholders
 * @param {Object} context - Variable context for formula evaluation
 * @returns {string} Rendered template with all placeholders replaced
 *
 * @example
 * // Simple variable substitution
 * renderTemplate('Hello {{Brand}}!', { Brand: 'Acme Corp' })
 * // Returns: "Hello Acme Corp!"
 *
 * @example
 * // Function call in template
 * renderTemplate('{{upper(Brand)}} - {{OriginalSearch}}', {
 *   Brand: 'acme corp',
 *   OriginalSearch: 'roofing'
 * })
 * // Returns: "ACME CORP - roofing"
 *
 * @description Errors in formula evaluation are captured and displayed
 * with [[ERR: ...]] formatting to maintain template integrity while
 * providing debugging information.
 */
function renderTemplate(template, context) {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, body) => {
    try {
      return String(evaluateFormula(body, context) ?? '');
    } catch (e) {
      return `[[ERR: ${e.message}]]`;
    }
  });
}

/**
 * Parses and evaluates a single argument token for function calls
 * Handles string literals, numeric values, function calls, and variable references
 *
 * @function parseArg
 * @param {string} token - The argument token to parse
 * @param {Object} ctx - Context object for variable and function resolution
 * @returns {string|number} Parsed and evaluated argument value
 *
 * @example
 * // String literal
 * parseArg('"hello"', {}) // Returns: "hello"
 *
 * // Numeric value
 * parseArg('42', {}) // Returns: 42
 *
 * // Variable reference
 * parseArg('Brand', { Brand: 'Acme' }) // Returns: "Acme"
 *
 * @description Supports type inference and nested function calls.
 * String literals use double-quote escaping. Numbers are automatically
 * converted to numeric type. Function calls are recursively evaluated.
 */
function parseArg(token, ctx) {
  token = token.trim();

  // String literal with escape sequence handling
  if (token.startsWith('"') && token.endsWith('"')) {
    return token.slice(1, -1).replace(/""/g, '"');
  }

  // Numeric literal detection and conversion
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);

  // Nested function call detection and evaluation
  const fm = token.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*\)$/);
  if (fm) return evaluateFormula(token, ctx);

  // Variable reference lookup
  return ctx[token];
}

/**
 * Splits a comma-separated argument string while respecting quoted strings
 * Parses function argument lists with proper quote handling
 *
 * @function splitArgs
 * @param {string} inner - The argument string to split (without outer parentheses)
 * @returns {Array<string>} Array of individual argument tokens
 *
 * @example
 * // Simple arguments
 * splitArgs('a, b, c') // Returns: ['a', 'b', 'c']
 *
 * // Arguments with quoted strings
 * splitArgs('"hello, world", var, "test"')
 * // Returns: ['"hello, world"', 'var', '"test"']
 *
 * @description Maintains quote context to avoid splitting on commas within
 * string literals. Handles nested quotes and whitespace normalization.
 * Essential for parsing complex function arguments correctly.
 */
function splitArgs(inner) {
  const args = [];
  let cur = '', inQ = false, i = 0;

  // Character-by-character parsing with quote state tracking
  while (i < inner.length) {
    const c = inner[i];
    if (inQ) {
      // Inside quoted string - only exit on closing quote
      if (c === '"') { inQ = false; cur += c; i++; continue; }
      cur += c; i++; continue;
    }
    if (c === '"') {
      // Entering quoted string
      inQ = true; cur += c; i++; continue;
    }
    if (c === ',') {
      // Argument separator - split here
      args.push(cur.trim()); cur=''; i++; continue;
    }
    cur += c; i++;
  }

  // Add final argument if present
  if (cur.trim().length) args.push(cur.trim());
  return args;
}

// Bulk Import

/**
 * Imports multiple keywords and generates CID URLs in batch
 * Validates input data and creates rows for each keyword with shared CID information
 *
 * @function importKeywords
 * @returns {void}
 *
 * @example
 * // User fills bulk import form and clicks "Generate CID URLs"
 * importKeywords();
 *
 * @description Reads form data from DOM elements and performs comprehensive
 * validation including:
 * - Required field validation (brand, CIDs, keywords)
 * - CID format validation (10-20 digit numbers)
 * - Keyword list parsing and validation
 *
 * Shows loading state during processing and provides detailed error messages
 * for validation failures. Supports both append and replace modes.
 *
 * @throws {void} Displays flash messages for validation errors or processing failures
 */
function importKeywords() {
  const brand = document.getElementById('impBrand')?.value.trim();
  const cidLoc = document.getElementById('impCidLoc')?.value.trim();
  const cidGmb = document.getElementById('impCidGmb')?.value.trim();
  const mode = document.getElementById('impMode')?.value;
  const kwsText = document.getElementById('impKws')?.value;

  // Comprehensive validation with detailed error reporting
  const errors = [];

  if (!brand) errors.push('GMB Brand Name is required');
  if (!cidLoc) errors.push('Location CID is required');
  if (!cidGmb) errors.push('GMB CID is required');
  if (!validateCID(cidLoc) && cidLoc) errors.push('Location CID must be 10-20 digits');
  if (!validateCID(cidGmb) && cidGmb) errors.push('GMB CID must be 10-20 digits');

  // Parse and validate keyword list
  const keywords = kwsText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!keywords.length) errors.push('At least one keyword is required');

  if (errors.length > 0) {
    flashError(`Please fix the following errors: ${errors.join(', ')}`);
    return;
  }

  // Show loading state with visual feedback
  const button = document.getElementById('impInsert');
  if (button) {
    button.classList.add('loading');
    button.disabled = true;
    button.textContent = 'Generating...';
  }

  try {
    populateFromImport(keywords, brand, cidLoc, cidGmb, mode);
    flashSuccess(`Successfully imported ${keywords.length} keywords`);
  } catch (error) {
    flashError('Failed to import keywords. Please check your input.');
  } finally {
    // Restore button state regardless of outcome
    if (button) {
      button.classList.remove('loading');
      button.disabled = false;
      button.textContent = 'Generate CID URLs';
    }
  }
}

/**
 * Populates the data table with keyword rows using shared CID information
 * Creates individual rows for each keyword with common brand and CID data
 *
 * @function populateFromImport
 * @param {Array<string>} keywords - Array of search keywords to create rows for
 * @param {string} brand - Google My Business brand name
 * @param {string} cidLoc - Location Customer ID for geographic targeting
 * @param {string} cidGmb - Google My Business Customer ID
 * @param {string} [mode='append'] - Import mode: 'append' to add to existing data, 'replace' to clear first
 * @returns {void}
 *
 * @example
 * // Import keywords in append mode
 * populateFromImport(
 *   ['roofing contractor', 'roof repair'],
 *   'Acme Roofing',
 *   '12673312613543755776',
 *   '8071969139480942171',
 *   'append'
 * );
 *
 * @description Creates a standardized row structure for each keyword while
 * sharing common CID and brand information. Computed columns (like FinalUrl)
 * are automatically calculated during rendering. Updates UI immediately after
 * population to show the new data.
 */
function populateFromImport(keywords, brand, cidLoc, cidGmb, mode = 'append') {
  // Clear existing data if replace mode is selected
  if (mode === 'replace') state.rows = [];

  // Create a row for each keyword with shared CID data
  for (const kw of keywords) {
    const row = {
      OriginalSearch: kw,
      Brand: brand,
      LocationCID: cidLoc,
      GMBCID: cidGmb
    };
    state.rows.push(row);
  }

  // Update UI and show confirmation
  renderAll();
  flash(`Imported ${keywords.length} keywords`);
}

// CID Management

/**
 * Validates a Customer ID (CID) format for Google services
 * Ensures CID is a numeric string between 10-20 digits
 *
 * @function validateCID
 * @param {string|number} cid - The Customer ID to validate
 * @returns {boolean} true if CID format is valid, false otherwise
 *
 * @example
 * validateCID('12673312613543755776') // Returns: true
 * validateCID('123') // Returns: false (too short)
 * validateCID('abc123') // Returns: false (contains letters)
 *
 * @description CIDs are used to identify specific Google My Business locations
 * and geographic areas in Google search URLs. They must be pure numeric
 * strings within the specified length range to function properly.
 */
function validateCID(cid) {
  return /^\d{10,20}$/.test(String(cid).trim());
}

/**
 * Returns a predefined library of location CIDs for common areas
 * Provides ready-to-use CID values for quick setup
 *
 * @function getCIDLibrary
 * @returns {Object<string, string>} Map of location names to CID values
 *
 * @example
 * const library = getCIDLibrary();
 * console.log(library['Chicago Downtown']); // '12673312613543755776'
 *
 * @description Maintains a curated list of verified CIDs for major
 * geographic areas. These values can be used directly in URL generation
 * or serve as examples for users discovering CID formats.
 */
function getCIDLibrary() {
  return {
    'Chicago Downtown': '12673312613543755776',
    'Chicago North Side': '15234567890123456789',
    'Chicago South Side': '98765432109876543210',
    'Chicago West Side': '11223344556677889900',
    'Chicago East Side': '99887766554433221100'
  };
}

/**
 * Adds a new CID to the location library after validation
 * Extends the CID library with user-provided location data
 *
 * @function addCIDToLibrary
 * @param {string} name - Human-readable location name
 * @param {string} cid - Customer ID for the location
 * @returns {boolean} true if successfully added, false if validation failed
 *
 * @example
 * // Add a new location CID
 * if (addCIDToLibrary('Chicago Loop', '98765432109876543210')) {
 *   console.log('CID added successfully');
 * }
 *
 * @description Validates the CID format before adding to prevent
 * invalid data in the library. Shows flash message on validation failure.
 * Note: Current implementation doesn't persist additions across sessions.
 */
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

/**
 * Generates a complete Google search URL with CID parameters
 * Creates targeted local search URLs using brand, keyword, and CID information
 *
 * @function generateFinalURL
 * @param {string} originalSearch - The original search keyword or phrase
 * @param {string} brand - Google My Business brand name
 * @param {string} locationCID - Geographic location Customer ID
 * @param {string} gmbCID - Google My Business Customer ID
 * @returns {string} Complete Google search URL with embedded CID parameters
 *
 * @example
 * const url = generateFinalURL(
 *   'roofing contractors',
 *   'Acme Roofing',
 *   '12673312613543755776',
 *   '8071969139480942171'
 * );
 * // Returns: https://www.google.com/search?q=acme+roofing&oq=roofing+contractors&rldimm=12673312613543755776&rlst=f#rlfi=hd:;si=8071969139480942171
 *
 * @description Constructs Google search URLs that target specific business
 * listings and geographic areas. The URL structure includes:
 * - q: Brand name (lowercase, spaces converted to +)
 * - oq: Original search term (spaces converted to +)
 * - rldimm: Location CID for geographic targeting
 * - si: GMB CID for business-specific targeting
 */
function generateFinalURL(originalSearch, brand, locationCID, gmbCID) {
  const template = 'https://www.google.com/search?q=keyword&oq=original&rldimm=000&rlst=f#rlfi=hd:;si=111';

  return template
    .replace('keyword', plusify(String(brand || '').toLowerCase()))
    .replace('original', plusify(originalSearch || ''))
    .replace('000', locationCID || '')
    .replace('111', gmbCID || '');
}

/**
 * Breaks down a URL into its component parts for visual analysis
 * Segments the URL to show different parameter types and values
 *
 * @function buildURLParts
 * @param {Object} row - Data row containing URL components
 * @param {string} row.Brand - Google My Business brand name
 * @param {string} row.OriginalSearch - Original search keyword
 * @param {string} row.LocationCID - Location Customer ID
 * @param {string} row.GMBCID - Google My Business Customer ID
 * @returns {Array<Object>} Array of URL segment objects with text and type
 * @returns {string} returns[].t - The text content of the segment
 * @returns {string} returns[].k - The segment type: 'const', 'brand', 'keyword', 'cidloc', 'cidgmb'
 *
 * @example
 * const parts = buildURLParts({
 *   Brand: 'Acme Roofing',
 *   OriginalSearch: 'roof repair',
 *   LocationCID: '12673312613543755776',
 *   GMBCID: '8071969139480942171'
 * });
 * // Returns array of segments for syntax highlighting
 *
 * @description Used primarily for UI visualization to highlight different
 * parts of the generated URL with color coding. Helps users understand
 * the URL structure and parameter placement.
 */
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

/**
 * Renders a visual composition preview of the generated URL structure
 * Shows syntax-highlighted URL breakdown using the first data row
 *
 * @function renderComposition
 * @returns {void}
 *
 * @example
 * // Called automatically during renderAll()
 * renderComposition();
 *
 * @description Creates a visual representation of the URL structure with
 * color-coded segments to help users understand how different data fields
 * contribute to the final URL. Uses the first row as a representative sample.
 *
 * The visualization highlights:
 * - Constant URL parts (gray)
 * - Brand components (blue)
 * - Keyword components (green)
 * - Location CID (orange)
 * - GMB CID (purple)
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

// Export/Import

/**
 * CSV parsing and stringification utilities
 * Handles proper escaping, quoted fields, and newline processing
 *
 * @namespace CSV
 * @description Provides robust CSV parsing that handles edge cases including:
 * - Quoted fields with embedded commas and newlines
 * - Escaped quotes within quoted fields
 * - Mixed line endings (\r\n, \n, \r)
 * - Empty fields and rows
 */
const CSV = {
  /**
   * Parses CSV text into a 2D array of values
   * Handles quoted fields, escaped quotes, and various line endings
   *
   * @function parse
   * @param {string} text - Raw CSV text to parse
   * @returns {Array<Array<string>>} 2D array where each sub-array represents a row
   *
   * @example
   * const csv = 'name,description\n"John Smith","A person with, commas"';
   * const data = CSV.parse(csv);
   * // Returns: [['name', 'description'], ['John Smith', 'A person with, commas']]
   *
   * @description Implements RFC 4180 CSV parsing with proper handling of:
   * - Quoted fields containing commas, newlines, or quotes
   * - Quote escaping with double quotes ("")
   * - Cross-platform line ending compatibility
   */
  parse(text) {
    const rows = [];
    let cur = [];
    let val = '';
    let i = 0, inQ = false;

    // Character-by-character parsing with quote state tracking
    while (i < text.length) {
      const c = text[i];
      if (inQ) {
        // Inside quoted field
        if (c === '"') {
          if (text[i+1] === '"') {
            // Escaped quote - add single quote to value
            val += '"'; i+=2; continue;
          }
          // End of quoted field
          inQ = false; i++; continue;
        } else {
          // Regular character inside quotes
          val += c; i++; continue;
        }
      }
      if (c === '"') {
        // Start of quoted field
        inQ = true; i++; continue;
      }
      if (c === ',') {
        // Field separator
        cur.push(val); val=''; i++; continue;
      }
      if (c === '\n') {
        // Row separator
        cur.push(val); rows.push(cur); cur=[]; val=''; i++; continue;
      }
      if (c === '\r') {
        // Skip carriage return (handle \r\n)
        i++; continue;
      }
      // Regular character
      val += c; i++;
    }

    // Handle final field/row
    if (val.length || cur.length) { cur.push(val); rows.push(cur); }
    return rows;
  },

  /**
   * Converts a 2D array into properly escaped CSV text
   * Handles field escaping and quote wrapping as needed
   *
   * @function stringify
   * @param {Array<Array<string>>} rows - 2D array of values to convert
   * @returns {string} Properly formatted CSV text
   *
   * @example
   * const data = [['Name', 'Note'], ['John', 'Has, comma']];
   * const csv = CSV.stringify(data);
   * // Returns: 'Name,Note\nJohn,"Has, comma"'
   *
   * @description Automatically quotes fields that contain special characters
   * (commas, quotes, newlines) and escapes internal quotes by doubling them.
   */
  stringify(rows) {
    const esc = (s) => {
      const str = String(s ?? '');
      // Quote fields containing special characters
      if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
      return str;
    };
    return rows.map(r => r.map(esc).join(',')).join('\n');
  }
};

/**
 * Exports all data (input and computed) to a CSV file
 * Generates a downloadable CSV containing all columns and computed values
 *
 * @function exportCSV
 * @returns {void}
 *
 * @example
 * // User clicks "Export CSV" button
 * exportCSV();
 *
 * @description Creates a complete data export including:
 * - All column headers in order
 * - Input data from user entries
 * - Computed values from formula evaluation
 * - Proper CSV formatting with escaping
 *
 * The exported file can be reopened in spreadsheet applications
 * or reimported into the tool. Computed columns will be recalculated
 * on import to ensure data integrity.
 */
/**
 * Unified export function that handles all export formats
 * Replaces multiple export buttons with single dropdown system
 */
function exportData(format) {
  const total = state.rows.length;

  switch(format) {
    case 'urls-txt':
      const urlsTxt = state.rows.map((r, i) => computeRow(r, i, total).FinalUrl || '').join('\n');
      downloadBlob(urlsTxt, 'text/plain;charset=utf-8', 'cid-urls.txt');
      flash('URLs exported as TXT');
      break;

    case 'urls-csv':
      const urlsCsv = CSV.stringify([['FinalUrl'], ...state.rows.map((r, i) => [computeRow(r, i, total).FinalUrl || ''])]);
      downloadBlob(urlsCsv, 'text/csv;charset=utf-8', 'cid-urls.csv');
      flash('URLs exported as CSV');
      break;

    case 'full-csv':
      const headers = state.columns.map(c => c.name);
      const rows = state.rows.map((r, i) => {
        const full = computeRow(r, i, total);
        return headers.map(h => full[h] ?? '');
      });
      const csv = CSV.stringify([headers, ...rows]);
      downloadBlob(csv, 'text/csv;charset=utf-8', 'cid-generator-data.csv');
      flash('Full data exported as CSV');
      break;

    default:
      flashError('Unknown export format');
  }
}

// Legacy function for backward compatibility
function exportCSV() {
  exportData('full-csv');
}

/**
 * Imports data from a CSV file into the application
 * Parses CSV and populates input columns while preserving computed formulas
 *
 * @function importCSV
 * @param {File} file - CSV file object from file input
 * @returns {void}
 *
 * @example
 * // User selects CSV file through file input
 * const fileInput = document.getElementById('csvImport');
 * fileInput.addEventListener('change', (e) => {
 *   if (e.target.files[0]) importCSV(e.target.files[0]);
 * });
 *
 * @description Safely imports CSV data with the following behavior:
 * - Uses first row as column headers
 * - Only imports data for existing input columns
 * - Ignores computed columns (they'll be recalculated)
 * - Replaces all existing data
 * - Shows import confirmation with row count
 *
 * This ensures data integrity by preventing import of stale computed
 * values that might not match current formulas.
 */
function importCSV(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    const rows = CSV.parse(text);
    if (!rows.length) return;

    const headers = rows[0];
    // Only import input columns to preserve formula integrity
    const inputCols = state.columns.filter(c => c.kind === 'input').map(c => c.name);
    const newRows = [];

    // Process each data row (skip header)
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const obj = {};
      headers.forEach((h, idx) => {
        // Only import recognized input columns
        if (inputCols.includes(h)) obj[h] = r[idx] ?? '';
      });
      newRows.push(obj);
    }

    // Replace existing data and refresh UI
    state.rows = newRows;
    renderAll();
    flash(`Imported ${newRows.length} rows`);
  };
  reader.readAsText(file);
}

/**
 * Creates and triggers a file download from string content
 * Generates a blob URL and initiates browser download
 *
 * @function downloadBlob
 * @param {string} content - File content to download
 * @param {string} mimeType - MIME type for the file (e.g., 'text/csv;charset=utf-8')
 * @param {string} filename - Suggested filename for the download
 * @returns {void}
 *
 * @example
 * // Download text content as a file
 * downloadBlob('Hello, world!', 'text/plain', 'greeting.txt');
 *
 * // Download CSV data
 * downloadBlob(csvData, 'text/csv;charset=utf-8', 'data.csv');
 *
 * @description Creates a temporary blob URL for the content and uses
 * a temporary anchor element to trigger the download. Properly cleans
 * up the blob URL after use to prevent memory leaks. Works across
 * modern browsers without requiring server-side file generation.
 */
function downloadBlob(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Clean up the blob URL to prevent memory leaks
  URL.revokeObjectURL(url);
}

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

  // Keywords Everywhere API event handlers
  document.getElementById('kwsSaveKey')?.addEventListener('click', onKwsSaveKey);
  document.getElementById('kwsClearKey')?.addEventListener('click', onKwsClearKey);
  document.getElementById('enrichKeywords')?.addEventListener('click', onEnrichKeywords);
  document.getElementById('findRelatedKeywords')?.addEventListener('click', onFindRelatedKeywords);

  // API key input field handlers
  const googleApiInput = document.getElementById('apiKeyInput');
  googleApiInput?.addEventListener('focus', function() {
    if (this.value.startsWith('••••')) {
      this.value = '';
      this.style.color = '';
      this.style.fontFamily = '';
      this.placeholder = 'Paste your key (optional)';
    }
  });
  googleApiInput?.addEventListener('blur', function() {
    if (!this.value.trim() && this.dataset.maskState === 'masked') {
      const stored = getGoogleApiKey();
      applyMaskedKeyToInput(this, {
        storedValue: stored,
        defaultValue: DEFAULT_GOOGLE_API_KEY,
        placeholderWhenDefault: 'Paste your key (optional)',
        placeholderWhenEmpty: 'Paste your key (optional)',
        maskedTitle: 'Stored API key (click to modify)'
      });
    }
  });

  const kwsApiInput = document.getElementById('kwsApiKeyInput');
  kwsApiInput?.addEventListener('focus', function() {
    if (this.value.startsWith('••••')) {
      this.value = '';
      this.style.color = '';
      this.style.fontFamily = '';
      this.placeholder = 'Your Keywords Everywhere API key';
    }
  });
  kwsApiInput?.addEventListener('blur', function() {
    if (!this.value.trim() && this.dataset.maskState === 'masked') {
      const stored = getKwsApiKey();
      applyMaskedKeyToInput(this, {
        storedValue: stored,
        defaultValue: DEFAULT_KWS_API_KEY,
        placeholderWhenDefault: 'Your Keywords Everywhere API key',
        placeholderWhenEmpty: 'Your Keywords Everywhere API key',
        maskedTitle: 'Stored KWS API key (click to modify)'
      });
    }
  });

  // Enhanced location discovery event handlers
  document.getElementById('findNearbyBusinesses')?.addEventListener('click', onFindNearbyBusinesses);
  document.getElementById('locationSearch')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') onFindNearbyBusinesses();
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

/**
 * Promise tracking for Google Maps API loading
 * Prevents multiple simultaneous API loads
 * @type {Promise|null}
 */
let googleLoading = null;

/**
 * Dynamically loads the Google Maps JavaScript API with Places library
 * Implements singleton pattern to prevent duplicate loads
 *
 * @function loadGooglePlaces
 * @param {string} apiKey - Google Maps API key for authentication
 * @returns {Promise<void>} Resolves when API is loaded and ready
 *
 * @example
 * // Load API before using Places services
 * await loadGooglePlaces('your-api-key');
 * // Now Google Places API is available
 *
 * @throws {Error} When API fails to load or Places library is unavailable
 *
 * @description Manages asynchronous loading of Google Maps API:
 * - Returns immediately if API is already loaded
 * - Reuses existing promise if load is in progress
 * - Creates new script tag for fresh loads
 * - Validates that Places library is available after load
 *
 * The singleton pattern ensures efficient resource usage and prevents
 * race conditions when multiple components need Places API access.
 */
function loadGooglePlaces(apiKey) {
  if (!String(apiKey || '').trim()) {
    return Promise.reject(new Error('Google API key is required to load Google Places.'));
  }

  // Return immediately if API is already loaded
  if (window.google?.maps?.places) return Promise.resolve();

  // Return existing promise if load is in progress
  if (googleLoading) return googleLoading;

  googleLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.async = true;
    script.onerror = () => {
      googleLoading = null;
      reject(new Error('Failed to load Google Maps JS'));
    };
    script.onload = () => {
      if (window.google?.maps?.places) {
        resolve();
        googleLoading = null;
      } else {
        googleLoading = null;
        reject(new Error('Google Places not available'));
      }
    };
    document.head.appendChild(script);
  });

  return googleLoading;
}

/**
 * Derives a Customer ID (CID) from a location name using Google Places API
 * Performs location search and extracts CID from Google My Business URL
 *
 * @function deriveCIDFromLocation
 * @param {string} location - Human-readable location name to search
 * @returns {Promise<string>} Promise resolving to the extracted CID
 *
 * @example
 * // Extract CID for a business location
 * try {
 *   const cid = await deriveCIDFromLocation('Starbucks Chicago Downtown');
 *   console.log('Found CID:', cid); // e.g., '12673312613543755776'
 * } catch (error) {
 *   console.error('CID extraction failed:', error.message);
 * }
 *
 * @throws {Error} When location is not found or CID cannot be extracted
 *
 * @description Implements a multi-step process:
 * 1. Loads Google Places API if not already available
 * 2. Searches for the location using text search
 * 3. Retrieves detailed place information including URL
 * 4. Extracts CID parameter from the Google My Business URL
 *
 * This automated CID discovery helps users avoid manual URL inspection
 * and reduces setup time for new locations.
 */
function deriveCIDFromLocation(location) {
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    return Promise.reject(new Error('Google API key is not configured.'));
  }

  return loadGooglePlaces(apiKey)
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
function flashSuccess(message) {
  flash(message, 'success');
}

function flashError(message) {
  flash(message, 'error');
}

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
  const out = document.getElementById('kwCount');
  if (!el || !out) return;

  // Parse textarea content to count valid keywords
  const lines = String(el.value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const count = lines.length;

  out.textContent = `URLs to generate: ${count}`;

  // Update ARIA label for better screen reader experience
  out.setAttribute('aria-label', `${count} URLs will be generated from the entered keywords`);

  // Visual feedback for count status
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

/**
 * Converts spaces in a string to plus signs for URL encoding
 * Prepares text for use in URL query parameters
 *
 * @function plusify
 * @param {string} string - Input string to convert
 * @returns {string} String with spaces replaced by plus signs
 *
 * @example
 * plusify('roofing contractor chicago') // Returns: 'roofing+contractor+chicago'
 * plusify('  extra   spaces  ') // Returns: 'extra+spaces'
 *
 * @description Performs URL-safe text transformation:
 * - Trims leading and trailing whitespace
 * - Replaces one or more consecutive spaces with single plus signs
 * - Handles null/undefined input gracefully
 *
 * Essential for creating properly formatted Google search URLs
 * where spaces in search terms must be encoded as plus signs.
 */
function plusify(string) {
  return String(string || '').trim().replace(/\s+/g, '+');
}

/**
 * Returns predefined template presets for common output formats
 * Provides ready-to-use templates for different use cases
 *
 * @function getTemplatePresets
 * @returns {Object<string, string>} Map of preset names to template strings
 *
 * @example
 * const presets = getTemplatePresets();
 * console.log(presets['Final URLs Only']); // '{{FinalUrl}}'
 *
 * @description Offers common template patterns:
 *
 * - **Final URLs Only**: Just the generated URLs
 * - **Keyword + Brand**: Simple keyword and brand combination
 * - **Full Details**: Complete data dump with all fields
 * - **Simple List**: Clean keyword-URL pairs
 *
 * Templates use {{variable}} syntax and support formula evaluation,
 * allowing users to quickly switch between different output formats
 * without manually writing template code.
 */
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

// Enhanced API Event Handlers

/**
 * Handles saving Keywords Everywhere API key
 */
function onKwsSaveKey() {
  const input = document.getElementById('kwsApiKeyInput');
  const key = input?.value.trim();

  if (!key) {
    flash('Enter a KWS API key before saving.', 'warning');
    return;
  }

  saveKwsApiKey(key)
    .then(() => {
      kwsApiKey = key;
      const maskResult = applyMaskedKeyToInput(input, {
        storedValue: key,
        defaultValue: DEFAULT_KWS_API_KEY,
        placeholderWhenDefault: 'Your Keywords Everywhere API key',
        placeholderWhenEmpty: 'Your Keywords Everywhere API key',
        maskedTitle: 'Stored KWS API key (click to modify)'
      });
      console.info('[MaskCheck] KWS API input state:', maskResult.state);
      let statusMessage = 'KWS API key saved successfully';
      let tone = 'success';

      if (maskResult.state === 'masked') {
        statusMessage = 'KWS API key saved securely (mask verified).';
        tone = 'success';
      } else if (maskResult.state === 'default') {
        statusMessage = 'KWS API key stored for this browser.';
        tone = 'success';
      } else if (maskResult.state === 'missing-input') {
        statusMessage = 'KWS API key saved but input field missing in DOM.';
        tone = 'warning';
      }

      updateKwsApiStatus(statusMessage, tone);
      flash('KWS API key saved');
    })
    .catch(() => {
      updateKwsApiStatus('Unable to save KWS API key', 'error');
      flash('Failed to save KWS API key', 'error');
    });
}

/**
 * Handles clearing Keywords Everywhere API key
 */
function onKwsClearKey() {
  clearKwsApiKey()
    .then(() => {
      const input = document.getElementById('kwsApiKeyInput');
      const maskResult = applyMaskedKeyToInput(input, {
        storedValue: '',
        defaultValue: DEFAULT_KWS_API_KEY,
        placeholderWhenDefault: 'Your Keywords Everywhere API key',
        placeholderWhenEmpty: 'Your Keywords Everywhere API key'
      });
      console.info('[MaskCheck] KWS API input state after clear:', maskResult.state);
      updateKwsApiStatus('KWS API key cleared', 'warning');
      flash('KWS API key cleared', 'warning');
    })
    .catch(() => {
      updateKwsApiStatus('Unable to clear KWS API key', 'error');
      flash('Failed to clear KWS API key', 'error');
    });
}

/**
 * Handles enriching keywords with search volume, CPC, and competition data
 */
async function onEnrichKeywords() {
  try {
    // Collect unique keywords from the OriginalSearch column (case-insensitive)
    const seen = new Set();
    const keywords = [];
    state.rows.forEach(row => {
      const raw = String(row?.OriginalSearch ?? '').trim();
      if (!raw) return;
      const normalized = raw.toLowerCase();
      if (seen.has(normalized)) return;
      seen.add(normalized);
      keywords.push(raw);
    });

    if (keywords.length === 0) {
      flash('No keywords found to enrich. Add some keywords first.', 'warning');
      return;
    }

    const limitedKeywords = keywords.slice(0, 100); // API limit

    updateKwsApiStatus(`Enriching ${limitedKeywords.length} keywords...`);
    flash(`Enriching ${limitedKeywords.length} keywords with market data...`);

    const data = await enrichKeywordsWithData(limitedKeywords);

    // Add new columns for keyword data if they don't exist
    addKeywordDataColumns();

    // Update rows with enriched data
    updateRowsWithKeywordData(data);

    renderAll();
    flash(`Successfully enriched ${limitedKeywords.length} keywords!`);

  } catch (error) {
    console.error('Keyword enrichment failed:', error);
    updateKwsApiStatus('Keyword enrichment failed');
    flash('Failed to enrich keywords: ' + error.message, 'error');
  }
}

/**
 * Handles finding related keywords
 */
async function onFindRelatedKeywords() {
  try {
    const textarea = document.getElementById('impKws');
    const keywords = textarea?.value.split('\n').filter(k => k.trim()).slice(0, 5); // Limit to first 5 for API costs

    if (!keywords || keywords.length === 0) {
      flash('Enter some base keywords to find related terms.', 'warning');
      return;
    }

    updateKwsApiStatus('Finding related keywords...');
    flash('Discovering related keywords...');

    let allRelated = [];
    for (const keyword of keywords) {
      try {
        const relatedData = await getRelatedKeywords(keyword.trim());
        if (relatedData?.data) {
          allRelated = allRelated.concat(relatedData.data.map(item => item.keyword || item));
        }
      } catch (err) {
        console.warn(`Failed to get related keywords for "${keyword}":`, err);
      }
    }

    if (allRelated.length > 0) {
      // Add unique related keywords to the textarea
      const existingKeywords = new Set(keywords.map(k => k.toLowerCase()));
      const newKeywords = allRelated.filter(k => !existingKeywords.has(k.toLowerCase()));

      if (newKeywords.length > 0) {
        const updatedText = keywords.concat(newKeywords.slice(0, 20)).join('\n'); // Limit additions
        textarea.value = updatedText;
        updateKeywordCount();
        flash(`Added ${newKeywords.length} related keywords!`);
      } else {
        flash('No new related keywords found.', 'warning');
      }
    } else {
      flash('No related keywords found.', 'warning');
    }

    updateKwsApiStatus('Related keywords search completed');

  } catch (error) {
    console.error('Related keywords search failed:', error);
    updateKwsApiStatus('Related keywords search failed');
    flash('Failed to find related keywords: ' + error.message, 'error');
  }
}

/**
 * Handles finding nearby businesses using Google Places API
 */
async function onFindNearbyBusinesses() {
  try {
    const searchInput = document.getElementById('locationSearch');
    const radiusSelect = document.getElementById('radiusSelect');
    const typeSelect = document.getElementById('businessTypeSelect');

    const query = searchInput?.value.trim();
    const radius = radiusSelect?.value || '5000';
    const type = typeSelect?.value || '';

    if (!query) {
      flash('Enter a location or business to search for.', 'warning');
      updateMapsApiStatus('Provide a location or business before running the nearby search.', 'warning');
      return;
    }

    updateMapsApiStatus(`Searching for "${query}" within ${Math.round(Number(radius) / 1000)}km...`);
    flash('Searching for nearby businesses...');
    console.log('Starting nearby business search for:', query);

    const apiKey = getGoogleApiKey();
    console.log('Using Google API key:', apiKey ? 'Key available' : 'No key');

    if (!apiKey) {
      flash('Google API key is required to search nearby businesses.', 'error');
      updateMapsApiStatus('Save a Google API key with Places access to run nearby searches.', 'error');
      return;
    }

    // Load Google Places API
    try {
      await loadGooglePlaces(apiKey);
      console.log('Google Places API loaded successfully');
      updateMapsApiStatus('Google Places API loaded. Retrieving businesses...');
    } catch (loadError) {
      console.error('Failed to load Google Places API:', loadError);
      flash('Failed to load Google Maps API: ' + loadError.message, 'error');
      updateMapsApiStatus('Unable to load Google Places API. Confirm the key is valid and has Places access.', 'error');
      return;
    }

    // Check if Google Places API is available
    if (!window.google?.maps?.places) {
      console.error('Google Places API not available after loading');
      flash('Google Places API not available. Please check your API key.', 'error');
      updateMapsApiStatus('Google Places API unavailable after loading. Check API key quotas and billing.', 'error');
      return;
    }

    // Perform text search
    const service = new google.maps.places.PlacesService(document.createElement('div'));
    console.log('Created Places service, performing search...');

    const searchResults = await performNearbySearch(service, query, radius, type);
    console.log('Search results:', searchResults);

    if (searchResults.length > 0) {
      displayBusinessResults(searchResults);
      flash(`Found ${searchResults.length} nearby businesses!`);
      updateMapsApiStatus(`Found ${searchResults.length} businesses for "${query}".`, 'success');
    } else {
      flash('No businesses found in the specified area.', 'warning');
      updateMapsApiStatus(`No businesses found for "${query}". Try expanding the radius or changing the type.`, 'warning');
    }

  } catch (error) {
    console.error('Nearby business search failed:', error);
    flash('Failed to find nearby businesses: ' + error.message, 'error');
    updateMapsApiStatus(`Nearby search failed: ${error.message}`, 'error');
  }
}

/**
 * Adds keyword data columns if they don't exist
 */
function addKeywordDataColumns() {
  const columnNames = state.columns.map(col => col.name);

  const newColumns = [
    { name: 'SearchVolume', label: 'Search Volume', kind: 'computed', formula: 'SearchVolume' },
    { name: 'CPC', label: 'CPC ($)', kind: 'computed', formula: 'CPC' },
    { name: 'Competition', label: 'Competition', kind: 'computed', formula: 'Competition' }
  ];

  newColumns.forEach(col => {
    if (!columnNames.includes(col.name)) {
      state.columns.push(col);
    }
  });
}

/**
 * Updates rows with enriched keyword data
 */
function updateRowsWithKeywordData(apiData) {
  if (!apiData?.data?.length) return;

  const keywordDataMap = new Map();
  apiData.data.forEach(item => {
    const rawKeyword = String(item?.keyword ?? '').trim();
    if (!rawKeyword) return;
    const normalized = rawKeyword.toLowerCase();
    keywordDataMap.set(normalized, {
      volume: item.vol ?? 0,
      cpc: item.cpc?.value ?? 0,
      competition: item.competition ?? 'N/A'
    });
  });

  if (!keywordDataMap.size) return;

  // Update existing rows with keyword data
  state.rows.forEach(row => {
    const rawKeyword = String(row?.OriginalSearch ?? '').trim();
    if (!rawKeyword) return;
    const data = keywordDataMap.get(rawKeyword.toLowerCase());
    if (!data) return;

    row.SearchVolume = data.volume;
    row.CPC = data.cpc;
    row.Competition = data.competition;
  });
}

/**
 * Performs nearby business search using Google Places API
 */
function performNearbySearch(service, query, radius, type) {
  return new Promise((resolve, reject) => {
    try {
      const request = {
        query: query,
        fields: ['name', 'place_id', 'formatted_address', 'geometry', 'types']
      };
      if (type) request.type = type;

      console.log('Places API request:', request);

      service.textSearch(request, (results, status) => {
        console.log('Places API response status:', status);
        console.log('Places API results:', results);

        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          resolve(results.slice(0, 10)); // Limit to 10 results
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]); // No results found, but not an error
        } else {
          const errorMessages = {
            'INVALID_REQUEST': 'Invalid search request',
            'OVER_QUERY_LIMIT': 'Query limit exceeded',
            'REQUEST_DENIED': 'Request denied - check API key permissions',
            'UNKNOWN_ERROR': 'Unknown error occurred'
          };
          const errorMessage = errorMessages[status] || `Places search failed: ${status}`;
          console.error('Places API error:', errorMessage);
          reject(new Error(errorMessage));
        }
      });
    } catch (error) {
      console.error('Error setting up Places search:', error);
      reject(error);
    }
  });
}

/**
 * Displays business search results in a modal or new section
 */
function displayBusinessResults(businesses) {
  // For now, we'll add them to the keyword list as location-based searches
  const textarea = document.getElementById('impKws');
  if (!textarea) return;

  const locationKeywords = businesses.map(business => {
    const name = business.name || '';
    const address = business.formatted_address || '';
    return `${name} ${address}`.trim();
  });

  const existingContent = textarea.value.trim();
  const newContent = existingContent ?
    existingContent + '\n' + locationKeywords.join('\n') :
    locationKeywords.join('\n');

  textarea.value = newContent;
  updateKeywordCount();
}

// Initialize Application

/**
 * Initializes the application on page load
 * Sets up data, events, and renders the initial UI
 *
 * @function initApp
 * @returns {void}
 *
 * @example
 * // Called automatically when DOM is ready
 * document.addEventListener('DOMContentLoaded', initApp);
 *
 * @description Performs complete application bootstrap:
 * 1. Attempts to load saved data from localStorage
 * 2. Ensures default data exists for first-time users
 * 3. Binds all event listeners for interactivity
 * 4. Renders the complete UI with current data
 *
 * This is the main entry point that transforms the static HTML
 * into a fully functional CID generator application.
 */
function initApp() {
  purgeServiceWorkers();
  recordAppVersionStamp();
  loadAll();
  ensureDefaults();
  bindEvents();
  initializeApiKeySettings();
  initializeKwsApiSettings();
  renderAll();
}

/**
 * Ensures default data exists for first-time users or corrupted state
 * Provides sample data to demonstrate application functionality
 *
 * @function ensureDefaults
 * @returns {void}
 *
 * @example
 * // Called during application initialization
 * ensureDefaults();
 *
 * @description Populates missing state with sensible defaults:
 *
 * - **Columns**: Standard CID generator column configuration
 * - **Rows**: Sample row with Chicago roofing company data
 * - **Template**: Simple URL-only output template
 *
 * The sample data serves multiple purposes:
 * - Demonstrates proper data format
 * - Provides immediate functionality for new users
 * - Shows expected CID format and structure
 * - Enables users to see results before entering their own data
 */
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

/**
 * Initialize dropdown menu functionality
 * Sets up click handlers for dropdown buttons and menus
 */
function initializeDropdowns() {
  // Export dropdown in data panel
  const exportDropdown = document.getElementById('exportDropdown');
  const exportMenu = document.getElementById('exportMenu');

  if (exportDropdown && exportMenu) {
    exportDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle('show');
      // Close other dropdowns
      document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
        if (menu !== exportMenu) menu.classList.remove('show');
      });
    });
  }

  // Results export dropdown
  const resultsExportDropdown = document.getElementById('resultsExportDropdown');
  const resultsExportMenu = document.getElementById('resultsExportMenu');

  if (resultsExportDropdown && resultsExportMenu) {
    resultsExportDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      resultsExportMenu.classList.toggle('show');
      // Close other dropdowns
      document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
        if (menu !== resultsExportMenu) menu.classList.remove('show');
      });
    });
  }

  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
      menu.classList.remove('show');
    });
  });
}

// Initialize app when DOM is ready, unless modern version is already loaded
document.addEventListener('DOMContentLoaded', () => {
  if (!window.cidApp) {
    initApp();
  } else {
    console.log('Modern CID app already initialized, skipping legacy init');
  }
});
