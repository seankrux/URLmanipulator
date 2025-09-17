// Performance Optimizations for Large Datasets

class PerformanceOptimizer {
  constructor(options = {}) {
    this.options = {
      virtualScrollThreshold: options.virtualScrollThreshold || 100,
      chunkSize: options.chunkSize || 50,
      debounceDelay: options.debounceDelay || 300,
      maxConcurrentOperations: options.maxConcurrentOperations || 3,
      ...options
    };

    // Performance monitoring
    this.metrics = {
      renderTimes: [],
      computeTimes: [],
      memoryUsage: []
    };

    // Worker pool for heavy computations
    this.workerPool = [];
    this.initializeWorkers();
  }

  /**
   * Initialize web workers for heavy computations
   */
  initializeWorkers() {
    if (typeof Worker === 'undefined') return;

    const workerScript = `
      // Web Worker for formula computations
      self.onmessage = function(e) {
        const { id, type, data } = e.data;

        try {
          let result;

          switch (type) {
            case 'computeFormulas':
              result = computeFormulasWorker(data);
              break;
            case 'processCSV':
              result = processCSVWorker(data);
              break;
            case 'generateURLs':
              result = generateURLsWorker(data);
              break;
            default:
              throw new Error('Unknown operation type');
          }

          self.postMessage({ id, success: true, result });
        } catch (error) {
          self.postMessage({ id, success: false, error: error.message });
        }
      };

      // Formula computation in worker
      function computeFormulasWorker({ formulas, contexts, functions }) {
        // Recreate formula functions in worker context
        const formulaFunctions = new Map(Object.entries(functions));

        return contexts.map((context, index) => {
          const formula = formulas[index];
          if (!formula) return '';

          try {
            return evaluateFormulaInWorker(formula, context, formulaFunctions);
          } catch (error) {
            return \`[[ERR: \${error.message}]]\`;
          }
        });
      }

      function evaluateFormulaInWorker(formula, context, functions) {
        // Simplified formula evaluation for worker
        const trimmed = formula.trim();

        // String literal
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          return trimmed.slice(1, -1).replace(/""/g, '"');
        }

        // Function call
        const funcMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\((.*)\\)$/);
        if (funcMatch) {
          const [, name, argsStr] = funcMatch;
          const func = functions.get(name);
          if (!func) throw new Error(\`Unknown function: \${name}\`);

          // Simple argument parsing for worker
          const args = argsStr ? argsStr.split(',').map(arg => {
            const trimmedArg = arg.trim();
            if (trimmedArg.startsWith('"') && trimmedArg.endsWith('"')) {
              return trimmedArg.slice(1, -1);
            }
            return context[trimmedArg] || trimmedArg;
          }) : [];

          return func(...args);
        }

        // Variable
        return context[trimmed] || '';
      }

      // CSV processing in worker
      function processCSVWorker({ csvText, chunkSize }) {
        const lines = csvText.split('\\n');
        const chunks = [];

        for (let i = 0; i < lines.length; i += chunkSize) {
          chunks.push(lines.slice(i, i + chunkSize));
        }

        return chunks;
      }

      // URL generation in worker
      function generateURLsWorker({ rows, template }) {
        return rows.map(row => {
          return template.replace(/\\{\\{([^}]+)\\}\\}/g, (match, key) => {
            return row[key] || '';
          });
        });
      }
    `;

    // Create worker blob
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    // Initialize worker pool
    for (let i = 0; i < this.options.maxConcurrentOperations; i++) {
      this.workerPool.push({
        worker: new Worker(workerUrl),
        busy: false,
        id: i
      });
    }
  }

  /**
   * Execute operation in worker
   */
  async executeInWorker(operation, data) {
    return new Promise((resolve, reject) => {
      const availableWorker = this.workerPool.find(w => !w.busy);

      if (!availableWorker) {
        // Fallback to main thread if no workers available
        return resolve(this.executeInMainThread(operation, data));
      }

      availableWorker.busy = true;
      const operationId = Date.now() + Math.random();

      const timeout = setTimeout(() => {
        availableWorker.busy = false;
        reject(new Error('Worker operation timeout'));
      }, 30000);

      availableWorker.worker.onmessage = (e) => {
        const { id, success, result, error } = e.data;

        if (id !== operationId) return;

        clearTimeout(timeout);
        availableWorker.busy = false;

        if (success) {
          resolve(result);
        } else {
          reject(new Error(error));
        }
      };

      availableWorker.worker.postMessage({
        id: operationId,
        type: operation,
        data
      });
    });
  }

  /**
   * Fallback execution in main thread
   */
  executeInMainThread(operation, data) {
    // Implement main thread fallbacks
    switch (operation) {
      case 'computeFormulas':
        return this.computeFormulasMainThread(data);
      case 'processCSV':
        return this.processCSVMainThread(data);
      case 'generateURLs':
        return this.generateURLsMainThread(data);
      default:
        throw new Error('Unknown operation');
    }
  }

  /**
   * Optimized batch row computation
   */
  async computeRowsBatch(rows, columns, chunkSize = null) {
    const startTime = performance.now();
    const actualChunkSize = chunkSize || this.options.chunkSize;

    // Filter computed columns
    const computedColumns = columns.filter(col => col.kind === 'computed');

    if (computedColumns.length === 0) {
      return rows.map(row => ({ ...row }));
    }

    // Process in chunks to avoid blocking UI
    const results = [];

    for (let i = 0; i < rows.length; i += actualChunkSize) {
      const chunk = rows.slice(i, i + actualChunkSize);

      // Process chunk
      const chunkResults = await this.processChunk(chunk, computedColumns, i, rows.length);
      results.push(...chunkResults);

      // Yield control to browser between chunks
      if (i + actualChunkSize < rows.length) {
        await this.yieldToMainThread();
      }
    }

    // Record performance metrics
    const endTime = performance.now();
    this.metrics.computeTimes.push(endTime - startTime);

    return results;
  }

  /**
   * Process a chunk of rows
   */
  async processChunk(chunk, computedColumns, startIndex, totalRows) {
    const formulas = computedColumns.map(col => col.formula || '');
    const contexts = chunk.map((row, idx) => ({
      ...row,
      rowIndex: startIndex + idx,
      totalRows,
      now: new Date()
    }));

    try {
      // Try to use worker for computation
      const results = await this.executeInWorker('computeFormulas', {
        formulas,
        contexts,
        functions: this.getSerializableFunctions()
      });

      // Merge results back into rows
      return chunk.map((row, idx) => {
        const computed = { ...row };
        computedColumns.forEach((col, colIdx) => {
          computed[col.name] = results[idx * computedColumns.length + colIdx];
        });
        return computed;
      });

    } catch (error) {
      // Fallback to main thread
      return this.processChunkMainThread(chunk, computedColumns, startIndex, totalRows);
    }
  }

  /**
   * Main thread chunk processing fallback
   */
  processChunkMainThread(chunk, computedColumns, startIndex, totalRows) {
    return chunk.map((row, idx) => {
      const context = {
        ...row,
        rowIndex: startIndex + idx,
        totalRows,
        now: new Date()
      };

      const computed = { ...row };

      computedColumns.forEach(col => {
        try {
          computed[col.name] = this.evaluateFormula(col.formula || '', context);
        } catch (error) {
          computed[col.name] = `[[ERR: ${error.message}]]`;
        }
      });

      return computed;
    });
  }

  /**
   * Virtual scrolling for large tables
   */
  createVirtualScrollTable(container, data, renderRow, itemHeight = 40) {
    if (data.length < this.options.virtualScrollThreshold) {
      // Use regular rendering for small datasets
      return this.renderRegularTable(container, data, renderRow);
    }

    const virtualScroller = new VirtualScroller({
      container,
      data,
      renderItem: renderRow,
      itemHeight,
      bufferSize: 10
    });

    return virtualScroller;
  }

  /**
   * Optimized CSV processing
   */
  async processLargeCSV(csvText) {
    const startTime = performance.now();

    try {
      // Use worker for large CSV files
      if (csvText.length > 100000) {
        const chunks = await this.executeInWorker('processCSV', {
          csvText,
          chunkSize: this.options.chunkSize
        });

        // Process chunks progressively
        const allRows = [];
        for (const chunk of chunks) {
          allRows.push(...this.parseCSVChunk(chunk));
          await this.yieldToMainThread();
        }

        return allRows;
      } else {
        // Process in main thread for smaller files
        return this.parseCSVMainThread(csvText);
      }
    } finally {
      const endTime = performance.now();
      this.metrics.renderTimes.push(endTime - startTime);
    }
  }

  /**
   * Memory usage optimization
   */
  optimizeMemoryUsage() {
    // Clear old performance metrics
    if (this.metrics.renderTimes.length > 100) {
      this.metrics.renderTimes = this.metrics.renderTimes.slice(-50);
    }
    if (this.metrics.computeTimes.length > 100) {
      this.metrics.computeTimes = this.metrics.computeTimes.slice(-50);
    }

    // Request garbage collection if available
    if (window.gc && typeof window.gc === 'function') {
      window.gc();
    }

    // Record memory usage
    if (performance.memory) {
      this.metrics.memoryUsage.push({
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        timestamp: Date.now()
      });

      // Keep only recent memory measurements
      if (this.metrics.memoryUsage.length > 50) {
        this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-25);
      }
    }
  }

  /**
   * Debounced function creator for frequent operations
   */
  createDebouncedFunction(func, delay = null) {
    const actualDelay = delay || this.options.debounceDelay;
    let timeoutId = null;

    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), actualDelay);
    };
  }

  /**
   * Yield control to main thread
   */
  yieldToMainThread() {
    return new Promise(resolve => {
      setTimeout(resolve, 0);
    });
  }

  /**
   * Get serializable functions for workers
   */
  getSerializableFunctions() {
    return {
      concat: (...args) => args.map(x => String(x ?? '')).join(''),
      upper: (s) => String(s ?? '').toUpperCase(),
      lower: (s) => String(s ?? '').toLowerCase(),
      trim: (s) => String(s ?? '').trim(),
      replace: (s, a, b) => String(s ?? '').split(String(a ?? '')).join(String(b ?? '')),
      default: (v, fb) => (v == null || v === '') ? fb : v
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      averageRenderTime: this.metrics.renderTimes.length > 0
        ? this.metrics.renderTimes.reduce((a, b) => a + b, 0) / this.metrics.renderTimes.length
        : 0,
      averageComputeTime: this.metrics.computeTimes.length > 0
        ? this.metrics.computeTimes.reduce((a, b) => a + b, 0) / this.metrics.computeTimes.length
        : 0,
      memoryTrend: this.metrics.memoryUsage.length > 1
        ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1].used - this.metrics.memoryUsage[0].used
        : 0,
      currentMemoryUsage: performance.memory?.usedJSHeapSize || 0
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Terminate workers
    this.workerPool.forEach(({ worker }) => {
      worker.terminate();
    });
    this.workerPool = [];

    // Clear metrics
    this.metrics = {
      renderTimes: [],
      computeTimes: [],
      memoryUsage: []
    };
  }
}

// Virtual Scroller Implementation
class VirtualScroller {
  constructor({ container, data, renderItem, itemHeight, bufferSize = 5 }) {
    this.container = container;
    this.data = data;
    this.renderItem = renderItem;
    this.itemHeight = itemHeight;
    this.bufferSize = bufferSize;

    this.scrollTop = 0;
    this.containerHeight = container.clientHeight;
    this.totalHeight = data.length * itemHeight;

    this.startIndex = 0;
    this.endIndex = 0;
    this.visibleItems = new Map();

    this.init();
  }

  init() {
    // Create scroll container
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.style.height = `${this.totalHeight}px`;
    this.scrollContainer.style.position = 'relative';

    // Create viewport
    this.viewport = document.createElement('div');
    this.viewport.style.position = 'absolute';
    this.viewport.style.top = '0';
    this.viewport.style.left = '0';
    this.viewport.style.right = '0';

    this.scrollContainer.appendChild(this.viewport);
    this.container.appendChild(this.scrollContainer);

    // Add scroll listener
    this.container.addEventListener('scroll', this.handleScroll.bind(this));

    // Initial render
    this.updateVisibleItems();
  }

  handleScroll() {
    this.scrollTop = this.container.scrollTop;
    this.updateVisibleItems();
  }

  updateVisibleItems() {
    const newStartIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
    const newEndIndex = Math.min(
      this.data.length - 1,
      Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight) + this.bufferSize
    );

    if (newStartIndex !== this.startIndex || newEndIndex !== this.endIndex) {
      this.startIndex = newStartIndex;
      this.endIndex = newEndIndex;
      this.renderVisibleItems();
    }
  }

  renderVisibleItems() {
    // Remove items that are no longer visible
    this.visibleItems.forEach((element, index) => {
      if (index < this.startIndex || index > this.endIndex) {
        element.remove();
        this.visibleItems.delete(index);
      }
    });

    // Add new visible items
    for (let i = this.startIndex; i <= this.endIndex; i++) {
      if (!this.visibleItems.has(i)) {
        const element = this.renderItem(this.data[i], i);
        element.style.position = 'absolute';
        element.style.top = `${i * this.itemHeight}px`;
        element.style.height = `${this.itemHeight}px`;

        this.viewport.appendChild(element);
        this.visibleItems.set(i, element);
      }
    }
  }

  updateData(newData) {
    this.data = newData;
    this.totalHeight = newData.length * this.itemHeight;
    this.scrollContainer.style.height = `${this.totalHeight}px`;

    // Clear existing items
    this.visibleItems.forEach(element => element.remove());
    this.visibleItems.clear();

    // Re-render
    this.updateVisibleItems();
  }

  destroy() {
    this.container.removeEventListener('scroll', this.handleScroll);
    this.scrollContainer.remove();
  }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PerformanceOptimizer, VirtualScroller };
}