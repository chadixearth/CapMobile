import { preloadMapData } from './map/fetchMap';
import mapCacheService from './map/mapCacheService';
import ApiInitService from './ApiInitService';
import NotificationService from './notificationService';
import { getCurrentUser } from './authService';

/**
 * App Initialization Service
 * Handles preloading of essential data when the app starts
 */
class AppInitService {
  constructor() {
    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize the app with essential data
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._performInitialization();
    return this.initPromise;
  }

  async _performInitialization() {
    try {
      console.log('[AppInit] Starting app initialization...');
      
      const startTime = Date.now();
      const results = {
        mapData: null,
        cacheInfo: null,
        errors: [],
        duration: 0
      };

      // Step 1: Preload map data
      try {
        console.log('[AppInit] Preloading map data...');
        results.mapData = await preloadMapData();
        console.log('[AppInit] Map data preloaded successfully');
      } catch (error) {
        console.error('[AppInit] Failed to preload map data:', error);
        results.errors.push({ type: 'map', error: error.message });
      }

      // Step 2: Get cache information
      try {
        results.cacheInfo = await mapCacheService.getCacheInfo();
        console.log('[AppInit] Cache info:', results.cacheInfo);
      } catch (error) {
        console.error('[AppInit] Failed to get cache info:', error);
        results.errors.push({ type: 'cache', error: error.message });
      }

      // Step 3: Initialize public API data
      try {
        console.log('[AppInit] Loading public API data...');
        await ApiInitService.loadPublicData();
        console.log('[AppInit] Public API data loaded');
      } catch (error) {
        console.error('[AppInit] Failed to load public API data:', error);
        results.errors.push({ type: 'api', error: error.message });
      }

      // Step 4: Initialize notifications
      try {
        console.log('[AppInit] Initializing notifications...');
        await NotificationService.initialize();
        console.log('[AppInit] Notifications initialized successfully');
      } catch (error) {
        console.error('[AppInit] Failed to initialize notifications:', error);
        results.errors.push({ type: 'notifications', error: error.message });
      }

      // Step 5: Clean up old cache if needed
      try {
        const storageInfo = await mapCacheService.getStorageSize();
        if (storageInfo && parseFloat(storageInfo.totalSizeMB) > 50) {
          console.log('[AppInit] Cache size exceeds 50MB, cleaning old tiles...');
        }
      } catch (error) {
        console.error('[AppInit] Failed to check storage size:', error);
      }

      results.duration = Date.now() - startTime;
      console.log(`[AppInit] Initialization completed in ${results.duration}ms`);
      
      this.isInitialized = true;
      return results;
    } catch (error) {
      console.error('[AppInit] Critical initialization error:', error);
      throw error;
    }
  }

  /**
   * Check if app is initialized
   * @returns {boolean} Initialization status
   */
  getInitStatus() {
    return this.isInitialized;
  }

  /**
   * Reset initialization (useful for testing or logout)
   */
  reset() {
    this.isInitialized = false;
    this.initPromise = null;
    ApiInitService.reset();
  }

  /**
   * Load authenticated data after login
   */
  async loadAuthenticatedData(userId) {
    try {
      console.log('[AppInit] Loading authenticated data for user:', userId);
      return await ApiInitService.loadAuthenticatedData(userId);
    } catch (error) {
      console.error('[AppInit] Failed to load authenticated data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear authenticated data on logout
   */
  clearAuthenticatedData() {
    ApiInitService.clearAuthenticatedData();
  }
}

// Export singleton instance
export default new AppInitService();
