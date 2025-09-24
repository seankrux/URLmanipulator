// Modern JavaScript Integration for CID Generator Tool

// Import optimized modules (when using module bundler)
// import { OptimizedFormulaEngine } from './optimized-formula-engine.js';
// import { GooglePlacesManager, AsyncErrorBoundary } from './optimized-async-patterns.js';
// import { OptimizedStateManager, StateValidators } from './optimized-state-management.js';
// import { PerformanceOptimizer } from './performance-optimizations.js';

/**
 * Modern ES6+ CID Generator Application Class
 */
class CIDGeneratorApp {
  #state = null;
  #formulaEngine = null;
  #placesManager = null;
  #performanceOptimizer = null;
  #errorBoundary = null;

  constructor(config = {}) {
    this.config = {
      googleApiKey: config.googleApiKey || '',
      storageKey: config.storageKey || "cid-generator-v1",
      enablePerformanceMode: config.enablePerformanceMode ?? true,
      enableWebWorkers: config.enableWebWorkers ?? true,
      ...config
    };

    this.initializeApp();
  }

  /**
   * Initialize the application with modern patterns
   */
  async initializeApp() {
    try {
      // Initialize core systems
      await this.#initializeState();
      await this.#initializeEngines();
      await this.#setupEventListeners();
      await this.#loadInitialData();

      console.log('CID Generator App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.#handleInitializationError(error);
    }
  }

  /**
   * Initialize reactive state management
   */
  async #initializeState() {
    const initialState = {
      view: 'input',
      columns: this.#getDefaultColumns(),
      rows: [],
      template: '{{FinalUrl}}',
      isLoading: false,
      error: null,
      metrics: {
        totalRows: 0,
        lastRenderTime: 0,
        memoryUsage: 0
      }
    };

    // Create reactive state manager
    this.#state = new OptimizedStateManager(initialState, {
      enableHistory: true,
      maxHistorySize: 50,
      debounceDelay: 16,
      enableValidation: true
    });

    // Add computed properties
    this.#state.addComputed('computedRows', (state) => {
      if (!state.rows.length) return [];
      return this.#formulaEngine?.evaluateFormulasBatch?.(
        state.columns.filter(col => col.kind === 'computed').map(col => col.formula),
        state.rows
      ) || state.rows;
    }, ['rows', 'columns']);

    this.#state.addComputed('finalUrls', (state) => {
      return state.rows.map((row, index) => {
        const computed = this.#computeRow(row, index, state.rows.length);
        return computed.FinalUrl || '';
      });
    }, ['rows', 'columns', 'template']);

    // Add validators
    this.#state.addValidator('rows', StateValidators.custom((rows) => {
      return Array.isArray(rows) && rows.length <= 10000; // Limit for performance
    }));

    // Subscribe to state changes for reactive UI updates
    this.#state.subscribe('view', this.#handleViewChange.bind(this));
    this.#state.subscribe('rows', this.#handleRowsChange.bind(this));
    this.#state.subscribe('columns', this.#handleColumnsChange.bind(this));
    this.#state.subscribe('isLoading', this.#handleLoadingChange.bind(this));
  }

  /**
   * Initialize processing engines
   */
  async #initializeEngines() {
    // Formula engine with caching
    this.#formulaEngine = new OptimizedFormulaEngine();

    // Google Places manager with async optimization
    this.#placesManager = new GooglePlacesManager(this.config.googleApiKey, {
      timeout: 10000,
      retryAttempts: 3,
      retryDelay: 1000
    });

    // Performance optimizer
    if (this.config.enablePerformanceMode) {
      this.#performanceOptimizer = new PerformanceOptimizer({
        virtualScrollThreshold: 100,
        chunkSize: 50,
        enableWebWorkers: this.config.enableWebWorkers
      });
    }

    // Error boundary for async operations
    this.#errorBoundary = new AsyncErrorBoundary();
    this.#errorBoundary.onError('Error', (error, context) => {
      console.error('Async error:', error, context);
      this.#state.state.error = error.message;
      return null; // Return fallback value
    });
  }

  /**
   * Setup modern event listeners with proper cleanup
   */
  async #setupEventListeners() {
    const eventMap = new Map([
      ['viewInput', () => this.#changeView('input')],
      ['viewCid', () => this.#changeView('cid')],
      ['impInsert', () => this.#importKeywords()],
      ['addRow', () => this.#addRow()],
      ['clearRows', () => this.#clearRows()],
      ['csvExport', () => this.#exportCSV()],
      ['generate', () => this.#generateOutput()],
      ['copyAll', () => this.#copyAllResults()],
      ['saveAll', () => this.#saveAll()],
      ['loadAll', () => this.#loadAll()],
      ['resetAll', () => this.#resetAll()]
    ]);

    // Add event listeners with automatic cleanup tracking
    this.#eventListeners = new Map();

    eventMap.forEach((handler, elementId) => {
      const element = document.getElementById(elementId);
      if (element) {
        const wrappedHandler = this.#wrapEventHandler(handler);
        element.addEventListener('click', wrappedHandler);
        this.#eventListeners.set(elementId, { element, event: 'click', handler: wrappedHandler });
      }
    });

    // Add input event listeners with debouncing
    const inputHandlers = new Map([
      ['impKws', this.#createDebouncedHandler(this.#updateKeywordCount.bind(this), 300)],
      ['template', this.#createDebouncedHandler(this.#updateTemplate.bind(this), 500)]
    ]);

    inputHandlers.forEach((handler, elementId) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.addEventListener('input', handler);
        this.#eventListeners.set(`${elementId}_input`, { element, event: 'input', handler });
      }
    });

    // CSV import with file handling
    const csvImport = document.getElementById('csvImport');
    if (csvImport) {
      const handler = this.#handleCSVImport.bind(this);
      csvImport.addEventListener('change', handler);
      this.#eventListeners.set('csvImport', { element: csvImport, event: 'change', handler });
    }

    // Keyboard shortcuts
    this.#setupKeyboardShortcuts();
  }

  /**
   * Setup keyboard shortcuts
   */
  #setupKeyboardShortcuts() {
    const shortcuts = new Map([
      ['ctrl+s', () => this.#saveAll()],
      ['ctrl+shift+l', () => this.#loadAll()],
      ['ctrl+shift+r', () => this.#resetAll()],
      ['ctrl+enter', () => this.#generateOutput()],
      ['ctrl+shift+c', () => this.#copyAllResults()]
    ]);

    const keyboardHandler = (event) => {
      const key = [
        event.ctrlKey ? 'ctrl' : '',
        event.shiftKey ? 'shift' : '',
        event.altKey ? 'alt' : '',
        event.key.toLowerCase()
      ].filter(Boolean).join('+');

      const handler = shortcuts.get(key);
      if (handler) {
        event.preventDefault();
        handler();
      }
    };

    document.addEventListener('keydown', keyboardHandler);
    this.#eventListeners.set('keyboard', { element: document, event: 'keydown', handler: keyboardHandler });
  }

  /**
   * Wrap event handlers for error handling and performance
   */
  #wrapEventHandler(handler) {
    return async (event) => {
      const startTime = performance.now();

      try {
        await this.#errorBoundary.execute(
          () => handler(event),
          { element: event.target, timestamp: Date.now() }
        );
      } catch (error) {
        this.#handleError(error, 'Event handler error');
      } finally {
        // Performance tracking
        const duration = performance.now() - startTime;
        if (duration > 100) {
          console.warn(`Slow event handler: ${duration.toFixed(2)}ms`);
        }
      }
    };
  }

  /**
   * Create debounced handler with modern syntax
   */
  #createDebouncedHandler(handler, delay) {
    let timeoutId = null;

    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => handler(...args), delay);
    };
  }

  /**
   * Modern async keyword import with validation
   */
  async #importKeywords() {
    const formData = this.#getFormData(['impBrand', 'impCidLoc', 'impCidGmb', 'impKws', 'impMode']);

    // Destructuring with defaults
    const {
      impBrand: brand = '',
      impCidLoc: cidLoc = '',
      impCidGmb: cidGmb = '',
      impKws: kwsText = '',
      impMode: mode = 'append'
    } = formData;

    // Input validation with detailed messages
    const validationResult = this.#validateImportData({ brand, cidLoc, cidGmb, kwsText });
    if (!validationResult.isValid) {
      this.#showError(`Please fix: ${validationResult.errors.join(', ')}`);
      return;
    }

    const keywords = kwsText.split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    this.#state.state.isLoading = true;

    try {
      // Use state batching for performance
      this.#state.batch((state) => {
        if (mode === 'replace') {
          state.rows = [];
        }

        const newRows = keywords.map(keyword => ({
          OriginalSearch: keyword,
          Brand: brand,
          LocationCID: cidLoc,
          GMBCID: cidGmb
        }));

        state.rows.push(...newRows);
      });

      this.#showSuccess(`Successfully imported ${keywords.length} keywords`);

    } catch (error) {
      this.#handleError(error, 'Failed to import keywords');
    } finally {
      this.#state.state.isLoading = false;
    }
  }

  /**
   * Modern CSV export with performance optimization
   */
  async #exportCSV() {
    try {
      this.#state.state.isLoading = true;

      const headers = this.#state.state.columns.map(col => col.name);
      const { computedRows } = this.#state.state;

      // Use performance optimizer for large datasets
      const csvData = this.#performanceOptimizer ?
        await this.#performanceOptimizer.executeInWorker('generateCSV', { headers, rows: computedRows }) :
        this.#generateCSVData(headers, computedRows);

      this.#downloadFile(csvData, 'text/csv', 'cid-generator-data.csv');
      this.#showSuccess('CSV exported successfully');

    } catch (error) {
      this.#handleError(error, 'Failed to export CSV');
    } finally {
      this.#state.state.isLoading = false;
    }
  }

  /**
   * Modern template rendering with streaming
   */
  async #generateOutput() {
    const template = this.#state.state.template;
    const rows = this.#state.state.rows;

    if (!template || !rows.length) {
      this.#showWarning('No template or data to generate');
      return;
    }

    try {
      this.#state.state.isLoading = true;

      const outputContainer = document.getElementById('outputs');
      if (!outputContainer) return;

      outputContainer.innerHTML = '';

      // Stream processing for large datasets
      if (this.#performanceOptimizer && rows.length > 100) {
        await this.#generateOutputStreaming(template, rows, outputContainer);
      } else {
        await this.#generateOutputStandard(template, rows, outputContainer);
      }

      this.#showSuccess(`Generated ${rows.length} outputs`);

    } catch (error) {
      this.#handleError(error, 'Failed to generate output');
    } finally {
      this.#state.state.isLoading = false;
    }
  }

  /**
   * Streaming output generation for performance
   */
  async #generateOutputStreaming(template, rows, container) {
    const chunkSize = 20;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const chunkElements = this.#renderOutputChunk(template, chunk, i);

      // Use document fragment for efficient DOM updates
      const fragment = document.createDocumentFragment();
      chunkElements.forEach(element => fragment.appendChild(element));
      container.appendChild(fragment);

      // Yield to main thread
      await this.#yieldToMainThread();
    }
  }

  /**
   * Standard output generation
   */
  async #generateOutputStandard(template, rows, container) {
    const elements = this.#renderOutputChunk(template, rows, 0);
    const fragment = document.createDocumentFragment();
    elements.forEach(element => fragment.appendChild(element));
    container.appendChild(fragment);
  }

  /**
   * Render output chunk with modern DOM manipulation
   */
  #renderOutputChunk(template, rows, startIndex) {
    return rows.map((row, index) => {
      const fullIndex = startIndex + index;
      const computedRow = this.#computeRow(row, fullIndex, this.#state.state.rows.length);
      const context = { ...computedRow, rowIndex: fullIndex, totalRows: this.#state.state.rows.length, now: new Date() };

      const text = this.#formulaEngine.renderTemplate?.(template, context) || '';

      // Use template literals for cleaner HTML generation
      const element = this.#createElement('li', {
        className: 'output-item',
        innerHTML: `
          <div class="output-actions">
            <button class="copy-btn" data-text="${this.#escapeHtml(text)}">Copy</button>
          </div>
          <pre class="output-content">${this.#escapeHtml(text)}</pre>
        `
      });

      // Add modern event listener
      const copyBtn = element.querySelector('.copy-btn');
      copyBtn?.addEventListener('click', async () => {
        await this.#copyToClipboard(text);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 1000);
      });

      return element;
    });
  }

  /**
   * Modern clipboard API usage
   */
  async #copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      this.#showSuccess('Copied to clipboard!');
    } catch (error) {
      this.#handleError(error, 'Failed to copy to clipboard');
    }
  }

  /**
   * State change handlers
   */
  #handleViewChange(view) {
    this.#updateTabStates(view);
    this.#renderView(view);
  }

  #handleRowsChange(rows) {
    this.#updateMetrics({ totalRows: rows.length });
    this.#renderTable();
    this.#renderUrlList();
  }

  #handleColumnsChange() {
    this.#renderTable();
  }

  #handleLoadingChange(isLoading) {
    this.#updateLoadingStates(isLoading);
  }

  /**
   * Utility methods with modern syntax
   */
  #getFormData(fieldIds) {
    return Object.fromEntries(
      fieldIds.map(id => [id, document.getElementById(id)?.value || ''])
    );
  }

  #validateImportData({ brand, cidLoc, cidGmb, kwsText }) {
    const errors = [];

    if (!brand) errors.push('GMB Brand Name is required');
    if (!cidLoc) errors.push('Location CID is required');
    if (!cidGmb) errors.push('GMB CID is required');
    if (cidLoc && !/^\d{10,20}$/.test(cidLoc)) errors.push('Location CID must be 10-20 digits');
    if (cidGmb && !/^\d{10,20}$/.test(cidGmb)) errors.push('GMB CID must be 10-20 digits');

    const keywords = kwsText.split(/\r?\n/).filter(line => line.trim());
    if (!keywords.length) errors.push('At least one keyword is required');

    return { isValid: errors.length === 0, errors };
  }

  #createElement(tagName, { className, innerHTML, ...attributes } = {}) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  }

  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  #yieldToMainThread() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  #showSuccess(message) {
    this.#showFlash(message, 'success');
  }

  #showError(message) {
    this.#showFlash(message, 'error');
  }

  #showWarning(message) {
    this.#showFlash(message, 'warning');
  }

  #showFlash(message, type = 'success') {
    // Implementation would use the enhanced flash system
    if (typeof flashSuccess === 'function' && type === 'success') {
      flashSuccess(message);
    } else if (typeof flashError === 'function' && type === 'error') {
      flashError(message);
    } else if (typeof flashWarning === 'function' && type === 'warning') {
      flashWarning(message);
    }
  }

  #handleError(error, context = '') {
    console.error(`${context}:`, error);
    this.#showError(`${context}: ${error.message}`);
  }

  /**
   * Cleanup method for proper resource management
   */
  destroy() {
    // Remove event listeners
    this.#eventListeners?.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });

    // Cleanup engines
    this.#formulaEngine?.clearCache?.();
    this.#placesManager?.clearCache?.();
    this.#performanceOptimizer?.destroy?.();

    // Clear state
    this.#state?.clearHistory?.();
  }

  /**
   * Get default columns with modern syntax
   */
  #getDefaultColumns() {
    return [
      { name: 'OriginalSearch', label: 'A: Original Search', kind: 'input' },
      { name: 'Brand', label: 'B: GMB Brand', kind: 'input' },
      { name: 'LocationCID', label: 'D: Location CID', kind: 'input' },
      { name: 'GMBCID', label: 'E: GMB CID', kind: 'input' },
      {
        name: 'SearchBase',
        label: 'I: Search Template',
        kind: 'computed',
        formula: '"https://www.google.com/search?q=keyword&oq=original&rldimm=000&rlst=f#rlfi=hd:;si=111"'
      },
      {
        name: 'FinalUrl',
        label: 'H: Final URL',
        kind: 'computed',
        formula: 'replace(replace(replace(replace(SearchBase, "keyword", replace(lower(Brand), " ", "+")), "original", replace(OriginalSearch, " ", "+")), "000", LocationCID), "111", GMBCID)'
      }
    ];
  }
}

// Initialize app when DOM is ready
if (typeof document !== 'undefined') {
  // Wait for dependencies to load and DOM to be ready
  function initializeWithDependencyCheck() {
    if (typeof OptimizedStateManager !== 'undefined' &&
        typeof OptimizedFormulaEngine !== 'undefined' &&
        typeof GooglePlacesManager !== 'undefined') {
      try {
        window.cidApp = new CIDGeneratorApp();
        console.log('CID Generator initialized with modern modules');
      } catch (error) {
        console.warn('Modern initialization failed, falling back to legacy:', error);
        fallbackToLegacy();
      }
    } else {
      console.log('Optimized modules not available, using legacy initialization');
      fallbackToLegacy();
    }
  }

  function fallbackToLegacy() {
    if (typeof initApp === 'function') {
      initApp();
    } else {
      console.error('No initialization function available');
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWithDependencyCheck);
  } else {
    initializeWithDependencyCheck();
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CIDGeneratorApp };
}
