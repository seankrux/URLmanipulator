
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
