
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
    script.onerror = () => reject(new Error('Failed to load Google Maps JS'));
    script.onload = () => {
      if (window.google?.maps?.places) resolve();
      else reject(new Error('Google Places not available'));
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

/**
 * Finds a place by text search.
 * @param {google.maps.places.PlacesService} service The Google Places service.
 * @param {string} query The text query to search for.
 * @returns {Promise<google.maps.places.PlaceResult>} A promise that resolves with the place result.
 */
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

/**
 * Gets the details of a place by its ID.
 * @param {google.maps.places.PlacesService} service The Google Places service.
 * @param {string} placeId The ID of the place to get details for.
 * @returns {Promise<google.maps.places.PlaceResult>} A promise that resolves with the place details.
 */
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

/**
 * Extracts the CID from a Google Maps URL.
 * @param {string} url The URL to extract the CID from.
 * @returns {string} The extracted CID, or an empty string if not found.
 */
function extractCIDFromUrl(url) {
  if (!url) return '';
  const m = url.match(/[?&]cid=(\d+)/);
  return m ? m[1] : '';
}
