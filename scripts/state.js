
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
