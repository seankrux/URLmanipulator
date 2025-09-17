// Optimized Async Patterns for Google Places Integration

class GooglePlacesManager {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.options = {
      timeout: options.timeout || 10000,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      ...options
    };

    // Request deduplication cache
    this.pendingRequests = new Map();
    this.resultCache = new Map();
    this.loadingPromise = null;

    // Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // Minimum 100ms between requests
  }

  /**
   * Load Google Places API with proper error handling and caching
   */
  async loadGooglePlaces() {
    // Return existing promise if already loading
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // Return immediately if already loaded
    if (this.isLoaded()) {
      return Promise.resolve();
    }

    this.loadingPromise = this._loadScript();

    try {
      await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  /**
   * Check if Google Places API is loaded
   */
  isLoaded() {
    return !!(window.google?.maps?.places?.PlacesService);
  }

  /**
   * Derive CID from location with comprehensive error handling
   */
  async deriveCIDFromLocation(location) {
    if (!location?.trim()) {
      throw new Error('Location is required');
    }

    const normalizedLocation = location.trim().toLowerCase();

    // Check cache first
    if (this.resultCache.has(normalizedLocation)) {
      return this.resultCache.get(normalizedLocation);
    }

    // Check for pending request to avoid duplicates
    if (this.pendingRequests.has(normalizedLocation)) {
      return this.pendingRequests.get(normalizedLocation);
    }

    // Create new request
    const requestPromise = this._deriveCIDWithRetry(normalizedLocation);
    this.pendingRequests.set(normalizedLocation, requestPromise);

    try {
      const result = await requestPromise;
      this.resultCache.set(normalizedLocation, result);
      return result;
    } finally {
      this.pendingRequests.delete(normalizedLocation);
    }
  }

  /**
   * Batch process multiple locations efficiently
   */
  async deriveCIDsBatch(locations) {
    const uniqueLocations = [...new Set(locations.map(loc => loc?.trim().toLowerCase()).filter(Boolean))];

    // Process in parallel with concurrency control
    const concurrencyLimit = 5;
    const results = new Map();

    for (let i = 0; i < uniqueLocations.length; i += concurrencyLimit) {
      const batch = uniqueLocations.slice(i, i + concurrencyLimit);

      const batchPromises = batch.map(async (location) => {
        try {
          const cid = await this.deriveCIDFromLocation(location);
          return { location, cid, success: true };
        } catch (error) {
          return { location, error: error.message, success: false };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ location, cid, error, success }) => {
        results.set(location, { cid, error, success });
      });

      // Rate limiting between batches
      if (i + concurrencyLimit < uniqueLocations.length) {
        await this._delay(this.minRequestInterval);
      }
    }

    return results;
  }

  /**
   * Private method to derive CID with retry logic
   */
  async _deriveCIDWithRetry(location) {
    let lastError;

    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        return await this._deriveCIDSingle(location);
      } catch (error) {
        lastError = error;

        // Don't retry on certain types of errors
        if (this._isNonRetryableError(error)) {
          throw error;
        }

        if (attempt < this.options.retryAttempts) {
          const delay = this.options.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await this._delay(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Single CID derivation with timeout
   */
  async _deriveCIDSingle(location) {
    await this.loadGooglePlaces();
    await this._respectRateLimit();

    const service = new google.maps.places.PlacesService(document.createElement('div'));

    // Step 1: Find place
    const place = await this._findPlaceByTextWithTimeout(service, location);
    if (!place?.place_id) {
      throw new Error(`Place not found for location: ${location}`);
    }

    // Step 2: Get place details
    const details = await this._getPlaceDetailsWithTimeout(service, place.place_id);
    if (!details?.url) {
      throw new Error(`Place details not found for: ${location}`);
    }

    // Step 3: Extract CID
    const cid = this._extractCIDFromUrl(details.url);
    if (!cid) {
      throw new Error(`CID not found in place URL for: ${location}`);
    }

    return cid;
  }

  /**
   * Find place with timeout
   */
  async _findPlaceByTextWithTimeout(service, query) {
    return Promise.race([
      this._findPlaceByText(service, query),
      this._timeoutPromise(this.options.timeout, `Find place timeout for: ${query}`)
    ]);
  }

  /**
   * Get place details with timeout
   */
  async _getPlaceDetailsWithTimeout(service, placeId) {
    return Promise.race([
      this._getPlaceDetails(service, placeId),
      this._timeoutPromise(this.options.timeout, `Place details timeout for: ${placeId}`)
    ]);
  }

  /**
   * Find place by text (promisified)
   */
  _findPlaceByText(service, query) {
    return new Promise((resolve, reject) => {
      const request = {
        query,
        fields: ['place_id', 'name', 'formatted_address']
      };

      // Try textSearch first
      service.textSearch({ query }, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
          resolve({ place_id: results[0].place_id });
          return;
        }

        // Fallback to findPlaceFromQuery
        service.findPlaceFromQuery(request, (results2, status2) => {
          if (status2 === google.maps.places.PlacesServiceStatus.OK && results2?.length) {
            resolve(results2[0]);
          } else {
            reject(new Error(`Place search failed: ${status2}`));
          }
        });
      });
    });
  }

  /**
   * Get place details (promisified)
   */
  _getPlaceDetails(service, placeId) {
    return new Promise((resolve, reject) => {
      const request = {
        placeId,
        fields: ['url', 'name', 'place_id']
      };

      service.getDetails(request, (result, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          resolve(result);
        } else {
          reject(new Error(`Place details failed: ${status}`));
        }
      });
    });
  }

  /**
   * Load Google Maps script
   */
  _loadScript() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(this.apiKey)}&libraries=places&v=weekly`;
      script.async = true;

      const timeout = setTimeout(() => {
        reject(new Error('Google Maps script load timeout'));
      }, this.options.timeout);

      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load Google Maps script'));
      };

      script.onload = () => {
        clearTimeout(timeout);
        if (this.isLoaded()) {
          resolve();
        } else {
          reject(new Error('Google Places API not available after script load'));
        }
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Extract CID from Google Place URL
   */
  _extractCIDFromUrl(url) {
    if (!url) return '';
    const match = url.match(/[?&]cid=(\d+)/);
    return match ? match[1] : '';
  }

  /**
   * Create a timeout promise
   */
  _timeoutPromise(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Rate limiting helper
   */
  async _respectRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      await this._delay(this.minRequestInterval - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error should not be retried
   */
  _isNonRetryableError(error) {
    const nonRetryableMessages = [
      'Place not found',
      'Invalid API key',
      'INVALID_REQUEST',
      'ZERO_RESULTS'
    ];

    return nonRetryableMessages.some(msg =>
      error.message?.includes(msg)
    );
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.resultCache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      resultCacheSize: this.resultCache.size,
      pendingRequestsSize: this.pendingRequests.size
    };
  }
}

// Enhanced error boundary for async operations
class AsyncErrorBoundary {
  constructor() {
    this.errorHandlers = new Map();
  }

  /**
   * Register error handler for specific error types
   */
  onError(errorType, handler) {
    if (!this.errorHandlers.has(errorType)) {
      this.errorHandlers.set(errorType, []);
    }
    this.errorHandlers.get(errorType).push(handler);
  }

  /**
   * Execute async operation with error handling
   */
  async execute(operation, context = {}) {
    try {
      return await operation();
    } catch (error) {
      return this._handleError(error, context);
    }
  }

  /**
   * Handle error with registered handlers
   */
  _handleError(error, context) {
    const errorType = error.constructor.name;
    const handlers = this.errorHandlers.get(errorType) || this.errorHandlers.get('default') || [];

    for (const handler of handlers) {
      try {
        const result = handler(error, context);
        if (result !== undefined) {
          return result;
        }
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    }

    // Re-throw if no handler processed the error
    throw error;
  }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GooglePlacesManager, AsyncErrorBoundary };
}