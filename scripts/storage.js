
// Storage and Configuration
const STORAGE_KEY = 'cid-generator-v1';
const GOOGLE_API_KEY_STORAGE = 'cid-generator-google-api';
let googleApiKey = '';

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

// Google Places API configuration management


/**
 * Checks if the Chrome Storage API is available.
 * @returns {boolean} True if the API is available, false otherwise.
 */
function chromeStorageAvailable() {
  try {
    return typeof chrome !== 'undefined' && !!chrome.storage?.sync;
  } catch {
    return false;
  }
}

/**
 * Sets the Google API key in the global variable.
 * @param {string} value The API key to set.
 */
function setGoogleApiKey(value) {
  googleApiKey = String(value || '').trim();
}

/**
 * Gets the Google API key from the global variable or a fallback.
 * @returns {string} The Google API key.
 */
function getGoogleApiKey() {
  if (googleApiKey) return googleApiKey;
  const fallback = window.cidAppConfig?.googleApiKey;
  if (fallback) setGoogleApiKey(fallback);
  return googleApiKey;
}

/**
 * Loads the Google API key from Chrome storage or local storage.
 * @returns {Promise<string>} A promise that resolves with the API key.
 */
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

/**
 * Persists the Google API key to Chrome storage and local storage.
 * @param {string} value The API key to persist.
 * @returns {Promise<string>} A promise that resolves with the sanitized API key.
 */
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

/**
 * Clears the Google API key from storage.
 * @returns {Promise<string>} A promise that resolves with the current API key after clearing.
 */
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

