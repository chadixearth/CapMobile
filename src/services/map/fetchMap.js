// API Configuration
import { Platform, NativeModules } from 'react-native';
import { apiRequest } from '../authService';
import mapCacheService from './mapCacheService';
import ResponseHandler from '../responseHandler';

// Helper function for API calls with better error handling
async function apiCall(endpoint, options = {}) {
  try {
    const result = await apiRequest(endpoint, options);
    
    if (result.success) {
      // Ensure data is properly structured
      if (!result.data || typeof result.data !== 'object') {
        return ResponseHandler.createSafeResponse(result.data || []);
      }
      return result.data;
    } else {
      throw new Error(result.data?.error || result.error || `HTTP ${result.status}: Request failed`);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please check your connection');
    }
    
    // Handle JSON parsing errors
    if (error.message?.includes('JSON Parse error') || error.message?.includes('Unexpected end of input')) {
      console.warn('[apiCall] JSON parsing error, returning safe fallback');
      return ResponseHandler.createSafeResponse([]);
    }
    
    throw error;
  }
}

/**
 * Fetch all map data with intelligent caching
 * @param {Object} options - Fetch options
 * @param {boolean} options.forceRefresh - Force refresh from server
 * @param {boolean} options.cacheOnly - Only use cached data
 * @returns {Promise<Object>} Comprehensive map data
 */
export async function fetchMapData(options = {}) {
  const { forceRefresh = false, cacheOnly = false } = options;
  
  try {
    console.log('[fetchMapData] Starting with options:', options);
    
    // Step 1: Try to load cached data first for instant display
    const cachedData = await mapCacheService.loadCachedMapData();
    
    if (cachedData && cacheOnly) {
      console.log('[fetchMapData] Returning cached data (cache only mode)');
      return cachedData;
    }
    
    // Step 2: If we have cached data and not forcing refresh, return it immediately
    // but still check for updates in the background
    if (cachedData && !forceRefresh) {
      console.log('[fetchMapData] Using cached data for instant display');
      
      // Start background update check
      fetchAndUpdateInBackground();
      
      return cachedData;
    }
    
    // Step 3: No cache or force refresh - fetch from server
    console.log('[fetchMapData] Fetching fresh data from server');
    const result = await apiCall('/map/data/');
    
    console.log('[fetchMapData] Server response:', {
      points: result.data?.total_items?.points || 0,
      roads: result.data?.total_items?.roads || 0,
      routes: result.data?.total_items?.routes || 0,
      zones: result.data?.total_items?.zones || 0,
    });
    
    // Process and validate the data
    const processedData = {
      points: result.data?.points || [],
      roads: result.data?.roads || [],
      routes: result.data?.routes || [],
      zones: result.data?.zones || [],
      config: result.data?.config || {
        center_latitude: 10.3157,
        center_longitude: 123.8854,
        zoom_level: 13,
        map_style: 'standard'
      },
      total_items: result.data?.total_items || {},
      lastUpdated: new Date().toISOString()
    };
    
    // Save to cache for next time
    await mapCacheService.saveMapData(processedData);
    
    return processedData;
  } catch (error) {
    console.error('[fetchMapData] Error:', error.message);
    
    // If we have cached data, return it even if expired
    const cachedData = await mapCacheService.loadCachedMapData();
    if (cachedData) {
      console.log('[fetchMapData] Returning cached data due to error');
      return cachedData;
    }
    
    // Return default data structure on error
    return {
      points: [],
      roads: [],
      routes: [],
      zones: [],
      config: {
        center_latitude: 10.3157,
        center_longitude: 123.8854,
        zoom_level: 13,
        map_style: 'standard'
      },
      total_items: {},
      error: true,
      errorMessage: error.message
    };
  }
}

/**
 * Background function to check and update map data
 * @private
 */
async function fetchAndUpdateInBackground() {
  try {
    console.log('[Background] Checking for map updates...');
    
    // Fetch latest data from server
    const result = await apiCall('/map/data/');
    
    if (result && result.data) {
      const processedData = {
        points: result.data?.points || [],
        roads: result.data?.roads || [],
        routes: result.data?.routes || [],
        zones: result.data?.zones || [],
        config: result.data?.config || {
          center_latitude: 10.3157,
          center_longitude: 123.8854,
          zoom_level: 13,
          map_style: 'standard'
        },
        total_items: result.data?.total_items || {},
        lastUpdated: new Date().toISOString()
      };
      
      // Check if update is needed
      const needsUpdate = await mapCacheService.needsUpdate(processedData);
      
      if (needsUpdate) {
        console.log('[Background] Map data has changed, updating cache');
        await mapCacheService.saveMapData(processedData);
        
        // Emit event or callback to notify UI of update
        // This would require an event emitter or callback system
        if (global.mapUpdateCallback) {
          global.mapUpdateCallback(processedData);
        }
      } else {
        console.log('[Background] Map data unchanged');
      }
    }
  } catch (error) {
    console.error('[Background] Error checking for updates:', error);
  }
}

/**
 * Clear map cache
 * @returns {Promise<boolean>} Success status
 */
export async function clearMapCache() {
  return await mapCacheService.clearCache();
}

/**
 * Get map cache information
 * @returns {Promise<Object>} Cache metadata
 */
export async function getMapCacheInfo() {
  return await mapCacheService.getCacheInfo();
}

/**
 * Preload map data on app startup
 * @returns {Promise<Object>} Cached or fresh map data
 */
export async function preloadMapData() {
  console.log('[preloadMapData] Preloading map data on startup');
  
  // Try to load from cache first
  const cachedData = await mapCacheService.loadCachedMapData();
  
  if (cachedData) {
    console.log('[preloadMapData] Found cached data, will update in background');
    // Update in background
    fetchAndUpdateInBackground();
    return cachedData;
  }
  
  // No cache, fetch fresh data
  console.log('[preloadMapData] No cache found, fetching fresh data');
  return await fetchMapData({ forceRefresh: true });
}

/**
 * Fetch only terminal/pickup points for map selection
 * @param {Object} params - Query parameters
 * @param {string} params.type - Filter by point type (pickup, station, landmark, terminal)
 * @param {boolean} params.active - Filter by active status
 * @returns {Promise<Object>} Terminal points data
 */
export async function fetchTerminals(params = {}) {
  try {
    console.log('[fetchTerminals] Fetching with params:', params);
    
    // Build query string
    const queryParams = new URLSearchParams();
    if (params.type) queryParams.append('type', params.type);
    if (params.active !== undefined) queryParams.append('active', params.active);
    
    const endpoint = `/map/terminals/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const result = await apiCall(endpoint);
    
    console.log('[fetchTerminals] Success:', {
      total: result.data?.total || 0,
      grouped: Object.keys(result.data?.grouped || {})
    });
    
    return {
      terminals: result.data?.terminals || [],
      grouped: result.data?.grouped || {},
      total: result.data?.total || 0
    };
  } catch (error) {
    console.error('[fetchTerminals] Error:', error.message);
    return {
      terminals: [],
      grouped: {},
      total: 0
    };
  }
}

/**
 * Fetch tartanilla routes for navigation
 * @param {Object} params - Query parameters
 * @param {boolean} params.active - Filter by active status
 * @param {string} params.type - Filter by route type
 * @returns {Promise<Object>} Routes data
 */
export async function fetchRoutes(params = {}) {
  try {
    console.log('[fetchRoutes] Fetching with params:', params);
    
    // Build query string
    const queryParams = new URLSearchParams();
    if (params.active !== undefined) queryParams.append('active', params.active);
    if (params.type) queryParams.append('type', params.type);
    
    const endpoint = `/map/routes/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const result = await apiCall(endpoint);
    
    console.log('[fetchRoutes] Success:', {
      total: result.data?.total || 0
    });
    
    return {
      routes: result.data?.routes || [],
      total: result.data?.total || 0
    };
  } catch (error) {
    console.error('[fetchRoutes] Error:', error.message);
    return {
      routes: [],
      total: 0
    };
  }
}

/**
 * Add a new map point
 * @param {Object} pointData - Point data to add
 * @returns {Promise<Object>} Added point data
 */
export async function addMapPoint(pointData) {
  try {
    console.log('[addMapPoint] Adding point:', pointData.name);
    
    const result = await apiCall('/map/points/', {
      method: 'POST',
      body: JSON.stringify(pointData)
    });
    
    console.log('[addMapPoint] Success:', result.data?.id);
    return result.data;
  } catch (error) {
    console.error('[addMapPoint] Error:', error.message);
    throw error;
  }
}

/**
 * Add a new road highlight
 * @param {Object} roadData - Road data to add
 * @returns {Promise<Object>} Added road data
 */
export async function addRoadHighlight(roadData) {
  try {
    console.log('[addRoadHighlight] Adding road:', roadData.name);
    
    const result = await apiCall('/map/roads/', {
      method: 'POST',
      body: JSON.stringify(roadData)
    });
    
    console.log('[addRoadHighlight] Success:', result.data?.id);
    return result.data;
  } catch (error) {
    console.error('[addRoadHighlight] Error:', error.message);
    throw error;
  }
}

/**
 * Update an existing map point
 * @param {string} pointId - ID of the point to update
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated point data
 */
export async function updateMapPoint(pointId, updateData) {
  try {
    console.log('[updateMapPoint] Updating point:', pointId);
    
    const result = await apiCall(`/map/points/${pointId}/`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
    
    console.log('[updateMapPoint] Success');
    return result.data;
  } catch (error) {
    console.error('[updateMapPoint] Error:', error.message);
    throw error;
  }
}

/**
 * Delete a map point
 * @param {string} pointId - ID of the point to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteMapPoint(pointId) {
  try {
    console.log('[deleteMapPoint] Deleting point:', pointId);
    
    await apiCall(`/map/points/${pointId}/delete/`, {
      method: 'DELETE'
    });
    
    console.log('[deleteMapPoint] Success');
    return true;
  } catch (error) {
    console.error('[deleteMapPoint] Error:', error.message);
    throw error;
  }
}
