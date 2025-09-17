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
  const location = document.getElementById('impLocation')?.value.trim();
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
    populateFromImport(keywords, brand, cidLoc, cidGmb, location, mode);
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
 * @param {string} location - Human-readable location name (unused in current implementation)
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
 *   'Chicago, IL',
 *   'append'
 * );
 *
 * @description Creates a standardized row structure for each keyword while
 * sharing common CID and brand information. Computed columns (like FinalUrl)
 * are automatically calculated during rendering. Updates UI immediately after
 * population to show the new data.
 */
function populateFromImport(keywords, brand, cidLoc, cidGmb, location, mode = 'append') {
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
  flash(`Imported ${newRows.length} keywords`);
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
   * - Quote escaping with double quotes (" ")
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
 * Unified export function that handles all export formats.
 * @param {string} format The export format (e.g., 'urls-txt', 'urls-csv', 'full-csv').
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

/**
 * Legacy function for backward compatibility.
 * Exports all data to a CSV file.
 */
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
