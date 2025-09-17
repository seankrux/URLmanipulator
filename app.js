// app.js

/**
 * Initializes the application.
 * This function is called when the DOM is ready.
 */
function initializeApp() {
  // Set default state if no data is loaded
  if (!loadAll()) {
    state.columns = defaultColumns();
  }

  // Bind all event listeners
  bindEvents();

  // Render the initial UI
  renderAll();

  // Load Google API key
  initializeApiKeySettings();
}

// Initialize the app when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);