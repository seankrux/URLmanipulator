// Optimized State Management with Reactivity and Performance

class OptimizedStateManager {
  constructor(initialState = {}, options = {}) {
    this.options = {
      enableHistory: options.enableHistory ?? true,
      maxHistorySize: options.maxHistorySize ?? 50,
      debounceDelay: options.debounceDelay ?? 16, // ~60fps
      enableValidation: options.enableValidation ?? true,
      ...options
    };

    // Internal state
    this._state = { ...initialState };
    this._listeners = new Map();
    this._computedCache = new Map();
    this._validators = new Map();

    // History management for undo/redo
    this._history = [];
    this._historyIndex = -1;

    // Performance optimization
    this._pendingUpdates = new Set();
    this._updateScheduled = false;
    this._renderQueue = new Set();

    // Batch update tracking
    this._batchDepth = 0;
    this._batchUpdates = new Map();

    // Create reactive proxy
    this._proxy = this._createReactiveProxy();
  }

  /**
   * Get the reactive state proxy
   */
  get state() {
    return this._proxy;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(path, listener, options = {}) {
    const { immediate = false, throttle = 0 } = options;
    const listenerKey = Symbol();

    let throttledListener = listener;
    if (throttle > 0) {
      throttledListener = this._throttle(listener, throttle);
    }

    if (!this._listeners.has(path)) {
      this._listeners.set(path, new Map());
    }

    this._listeners.get(path).set(listenerKey, {
      callback: throttledListener,
      options
    });

    // Call immediately with current value if requested
    if (immediate) {
      const currentValue = this._getValueAtPath(path);
      throttledListener(currentValue, undefined, path);
    }

    // Return unsubscribe function
    return () => {
      const pathListeners = this._listeners.get(path);
      if (pathListeners) {
        pathListeners.delete(listenerKey);
        if (pathListeners.size === 0) {
          this._listeners.delete(path);
        }
      }
    };
  }

  /**
   * Add computed property
   */
  addComputed(name, computeFn, dependencies = []) {
    this._computedCache.set(name, {
      compute: computeFn,
      dependencies,
      value: undefined,
      isDirty: true
    });

    // Subscribe to dependencies
    dependencies.forEach(dep => {
      this.subscribe(dep, () => {
        this._invalidateComputed(name);
      });
    });

    // Add getter to proxy
    Object.defineProperty(this._proxy, name, {
      get: () => this._getComputed(name),
      enumerable: true,
      configurable: true
    });
  }

  /**
   * Add validator for a path
   */
  addValidator(path, validator) {
    if (!this._validators.has(path)) {
      this._validators.set(path, []);
    }
    this._validators.get(path).push(validator);
  }

  /**
   * Batch multiple updates
   */
  batch(updateFn) {
    this._batchDepth++;

    try {
      updateFn(this._proxy);
    } finally {
      this._batchDepth--;

      if (this._batchDepth === 0) {
        this._flushBatchUpdates();
      }
    }
  }

  /**
   * Undo last change
   */
  undo() {
    if (!this.canUndo()) return false;

    this._historyIndex--;
    const previousState = this._history[this._historyIndex];
    this._restoreState(previousState, false);
    return true;
  }

  /**
   * Redo next change
   */
  redo() {
    if (!this.canRedo()) return false;

    this._historyIndex++;
    const nextState = this._history[this._historyIndex];
    this._restoreState(nextState, false);
    return true;
  }

  /**
   * Check if undo is possible
   */
  canUndo() {
    return this.options.enableHistory && this._historyIndex > 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo() {
    return this.options.enableHistory && this._historyIndex < this._history.length - 1;
  }

  /**
   * Save current state to history
   */
  saveToHistory() {
    if (!this.options.enableHistory) return;

    const stateSnapshot = this._deepClone(this._state);

    // Remove any states after current index (when we're not at the end)
    if (this._historyIndex < this._history.length - 1) {
      this._history.splice(this._historyIndex + 1);
    }

    // Add new state
    this._history.push(stateSnapshot);
    this._historyIndex++;

    // Limit history size
    if (this._history.length > this.options.maxHistorySize) {
      this._history.shift();
      this._historyIndex--;
    }
  }

  /**
   * Get state snapshot
   */
  getSnapshot() {
    return this._deepClone(this._state);
  }

  /**
   * Restore state from snapshot
   */
  restoreFromSnapshot(snapshot, saveToHistory = true) {
    this._restoreState(snapshot, saveToHistory);
  }

  /**
   * Clear history
   */
  clearHistory() {
    this._history = [];
    this._historyIndex = -1;
  }

  /**
   * Create reactive proxy
   */
  _createReactiveProxy() {
    return new Proxy(this._state, {
      get: (target, prop) => {
        // Handle computed properties
        if (this._computedCache.has(prop)) {
          return this._getComputed(prop);
        }

        return target[prop];
      },

      set: (target, prop, value) => {
        const oldValue = target[prop];

        // Skip if value hasn't changed (shallow comparison)
        if (oldValue === value) {
          return true;
        }

        // Validate if enabled
        if (this.options.enableValidation) {
          const isValid = this._validateValue(prop, value, oldValue);
          if (!isValid) {
            return false;
          }
        }

        // Update value
        target[prop] = value;

        // Handle batch updates
        if (this._batchDepth > 0) {
          this._batchUpdates.set(prop, { oldValue, newValue: value });
        } else {
          this._notifyChange(prop, value, oldValue);
        }

        return true;
      },

      deleteProperty: (target, prop) => {
        const oldValue = target[prop];
        delete target[prop];

        if (this._batchDepth > 0) {
          this._batchUpdates.set(prop, { oldValue, newValue: undefined });
        } else {
          this._notifyChange(prop, undefined, oldValue);
        }

        return true;
      }
    });
  }

  /**
   * Notify listeners of changes
   */
  _notifyChange(path, newValue, oldValue) {
    // Add to pending updates
    this._pendingUpdates.add({ path, newValue, oldValue });

    // Schedule update if not already scheduled
    if (!this._updateScheduled) {
      this._updateScheduled = true;
      this._scheduleUpdate();
    }
  }

  /**
   * Schedule update with debouncing
   */
  _scheduleUpdate() {
    if (this.options.debounceDelay > 0) {
      setTimeout(() => this._flushUpdates(), this.options.debounceDelay);
    } else {
      requestAnimationFrame(() => this._flushUpdates());
    }
  }

  /**
   * Flush pending updates
   */
  _flushUpdates() {
    this._updateScheduled = false;

    // Save to history before processing updates
    this.saveToHistory();

    // Process all pending updates
    this._pendingUpdates.forEach(({ path, newValue, oldValue }) => {
      this._notifyListeners(path, newValue, oldValue);
    });

    this._pendingUpdates.clear();
  }

  /**
   * Flush batch updates
   */
  _flushBatchUpdates() {
    if (this._batchUpdates.size === 0) return;

    // Save to history once for the entire batch
    this.saveToHistory();

    // Notify all listeners
    this._batchUpdates.forEach(({ oldValue, newValue }, path) => {
      this._notifyListeners(path, newValue, oldValue);
    });

    this._batchUpdates.clear();
  }

  /**
   * Notify listeners for a specific path
   */
  _notifyListeners(path, newValue, oldValue) {
    const pathListeners = this._listeners.get(path);
    if (!pathListeners) return;

    pathListeners.forEach(({ callback }) => {
      try {
        callback(newValue, oldValue, path);
      } catch (error) {
        console.error(`Error in state listener for path "${path}":`, error);
      }
    });

    // Also notify wildcard listeners (path: '*')
    const wildcardListeners = this._listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(({ callback }) => {
        try {
          callback(newValue, oldValue, path);
        } catch (error) {
          console.error('Error in wildcard state listener:', error);
        }
      });
    }
  }

  /**
   * Get computed value
   */
  _getComputed(name) {
    const computed = this._computedCache.get(name);
    if (!computed) return undefined;

    if (computed.isDirty) {
      try {
        computed.value = computed.compute(this._proxy);
        computed.isDirty = false;
      } catch (error) {
        console.error(`Error computing "${name}":`, error);
        return undefined;
      }
    }

    return computed.value;
  }

  /**
   * Invalidate computed property
   */
  _invalidateComputed(name) {
    const computed = this._computedCache.get(name);
    if (computed) {
      computed.isDirty = true;
    }
  }

  /**
   * Validate value
   */
  _validateValue(path, value, oldValue) {
    const validators = this._validators.get(path);
    if (!validators) return true;

    return validators.every(validator => {
      try {
        return validator(value, oldValue, this._proxy);
      } catch (error) {
        console.error(`Validation error for path "${path}":`, error);
        return false;
      }
    });
  }

  /**
   * Get value at path
   */
  _getValueAtPath(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this._state);
  }

  /**
   * Restore state
   */
  _restoreState(snapshot, saveToHistory = true) {
    const oldState = this._deepClone(this._state);

    // Update state without triggering listeners
    Object.keys(this._state).forEach(key => {
      delete this._state[key];
    });
    Object.assign(this._state, snapshot);

    if (saveToHistory) {
      this.saveToHistory();
    }

    // Notify all listeners of the change
    this._notifyListeners('*', this._state, oldState);
  }

  /**
   * Deep clone helper
   */
  _deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => this._deepClone(item));

    const cloned = {};
    Object.keys(obj).forEach(key => {
      cloned[key] = this._deepClone(obj[key]);
    });
    return cloned;
  }

  /**
   * Throttle helper
   */
  _throttle(func, delay) {
    let lastCall = 0;
    let timeoutId = null;

    return (...args) => {
      const now = Date.now();

      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          func(...args);
        }, delay - (now - lastCall));
      }
    };
  }
}

// State validators
const StateValidators = {
  required: (value) => value != null && value !== '',

  minLength: (min) => (value) =>
    String(value || '').length >= min,

  maxLength: (max) => (value) =>
    String(value || '').length <= max,

  pattern: (regex) => (value) =>
    regex.test(String(value || '')),

  arrayMinLength: (min) => (value) =>
    Array.isArray(value) && value.length >= min,

  arrayMaxLength: (max) => (value) =>
    Array.isArray(value) && value.length <= max,

  custom: (fn) => fn
};

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OptimizedStateManager, StateValidators };
}