import { tourPackageService } from './tourpackage/fetchPackage';
import { carriageService } from './tourpackage/fetchCarriage';
import { checkAuthStatus } from './authService';

/**
 * API Initialization Service
 * Manages loading of public and authenticated APIs
 */
class ApiInitService {
  constructor() {
    this.publicDataCache = {};
    this.authenticatedDataCache = {};
    this.isPublicDataLoaded = false;
    this.isAuthenticatedDataLoaded = false;
    this.loadingPromises = {};
  }

  /**
   * Load public APIs that don't require authentication
   * Called on app startup
   */
  async loadPublicData() {
    // Skip public data loading - let components handle it directly
    console.log('[ApiInit] Skipping public data loading - handled by components');
    this.isPublicDataLoaded = true;
    return { success: true, data: {}, duration: 0, errors: [] };
  }

  /**
   * Load authenticated APIs that require login
   * Called after successful login
   */
  async loadAuthenticatedData(userId) {
    if (this.loadingPromises.authenticated) {
      return this.loadingPromises.authenticated;
    }

    this.loadingPromises.authenticated = this._loadAuthenticatedData(userId);
    return this.loadingPromises.authenticated;
  }

  async _loadAuthenticatedData(userId) {
    try {
      console.log('[ApiInit] Loading authenticated data for user:', userId);
      const startTime = Date.now();
      
      // Check if user is actually authenticated
      const authStatus = await checkAuthStatus();
      if (!authStatus.isLoggedIn) {
        console.warn('[ApiInit] User not authenticated, skipping authenticated data load');
        return { success: false, error: 'User not authenticated' };
      }

      const results = await Promise.allSettled([
        this._loadUserBookings(userId),
        this._loadUserCarriages(userId, authStatus.user.role),
        this._loadUserEarnings(userId, authStatus.user.role),
      ]);

      // Process results
      const dataKeys = ['bookings', 'userCarriages', 'earnings'];
      results.forEach((result, index) => {
        const apiName = dataKeys[index];
        if (result.status === 'fulfilled') {
          this.authenticatedDataCache[apiName] = result.value;
          console.log(`[ApiInit] ${apiName} loaded successfully`);
        } else {
          console.warn(`[ApiInit] Failed to load ${apiName}:`, result.reason?.message);
          this.authenticatedDataCache[apiName] = [];
        }
      });

      this.isAuthenticatedDataLoaded = true;
      const duration = Date.now() - startTime;
      console.log(`[ApiInit] Authenticated data loaded in ${duration}ms`);
      
      return {
        success: true,
        data: this.authenticatedDataCache,
        duration,
        errors: results.filter(r => r.status === 'rejected').map(r => r.reason?.message)
      };
    } catch (error) {
      console.error('[ApiInit] Failed to load authenticated data:', error);
      return { success: false, error: error.message };
    } finally {
      this.loadingPromises.authenticated = null;
    }
  }

  // Public API loaders (simplified)
  async _loadTourPackages() {
    return [];
  }

  async _loadCarriages() {
    return [];
  }

  // Authenticated API loaders
  async _loadUserBookings(userId) {
    try {
      // Import booking service dynamically to avoid circular dependencies
      const { default: bookingService } = await import('./tourpackage/requestBooking');
      return await bookingService.getUserBookings(userId);
    } catch (error) {
      console.warn('[ApiInit] User bookings unavailable:', error.message);
      return [];
    }
  }

  async _loadUserCarriages(userId, userRole) {
    try {
      if (userRole === 'owner') {
        return await carriageService.getByOwner(userId);
      } else if (userRole === 'driver') {
        return await carriageService.getByDriver(userId);
      }
      return [];
    } catch (error) {
      console.warn('[ApiInit] User carriages unavailable:', error.message);
      return [];
    }
  }

  async _loadUserEarnings(userId, userRole) {
    try {
      if (userRole === 'driver' || userRole === 'owner') {
        const { default: earningsService } = await import('./earningsService');
        return await earningsService.getEarnings(userId);
      }
      return [];
    } catch (error) {
      console.warn('[ApiInit] User earnings unavailable:', error.message);
      return [];
    }
  }

  /**
   * Get cached public data
   */
  getPublicData(key) {
    if (key) {
      return this.publicDataCache[key] || [];
    }
    return this.publicDataCache;
  }

  /**
   * Get cached authenticated data
   */
  getAuthenticatedData(key) {
    if (key) {
      return this.authenticatedDataCache[key] || [];
    }
    return this.authenticatedDataCache;
  }

  /**
   * Clear authenticated data cache (on logout)
   */
  clearAuthenticatedData() {
    this.authenticatedDataCache = {};
    this.isAuthenticatedDataLoaded = false;
    this.loadingPromises.authenticated = null;
    console.log('[ApiInit] Authenticated data cache cleared');
  }

  /**
   * Refresh specific data
   */
  async refreshData(dataType, userId = null) {
    try {
      switch (dataType) {
        case 'tourPackages':
          this.publicDataCache.tourPackages = await this._loadTourPackages();
          break;
        case 'carriages':
          this.publicDataCache.carriages = await this._loadCarriages();
          break;
        case 'bookings':
          if (userId) {
            this.authenticatedDataCache.bookings = await this._loadUserBookings(userId);
          }
          break;
        case 'userCarriages':
          if (userId) {
            const authStatus = await checkAuthStatus();
            this.authenticatedDataCache.userCarriages = await this._loadUserCarriages(userId, authStatus.user?.role);
          }
          break;
        case 'earnings':
          if (userId) {
            const authStatus = await checkAuthStatus();
            this.authenticatedDataCache.earnings = await this._loadUserEarnings(userId, authStatus.user?.role);
          }
          break;
        default:
          throw new Error(`Unknown data type: ${dataType}`);
      }
      console.log(`[ApiInit] ${dataType} refreshed successfully`);
      return true;
    } catch (error) {
      console.error(`[ApiInit] Failed to refresh ${dataType}:`, error);
      return false;
    }
  }

  /**
   * Get loading status
   */
  getStatus() {
    return {
      publicDataLoaded: this.isPublicDataLoaded,
      authenticatedDataLoaded: this.isAuthenticatedDataLoaded,
      publicDataCount: Object.keys(this.publicDataCache).length,
      authenticatedDataCount: Object.keys(this.authenticatedDataCache).length,
    };
  }

  /**
   * Reset all data (for testing or complete refresh)
   */
  reset() {
    this.publicDataCache = {};
    this.authenticatedDataCache = {};
    this.isPublicDataLoaded = false;
    this.isAuthenticatedDataLoaded = false;
    this.loadingPromises = {};
    console.log('[ApiInit] All data cache reset');
  }
}

// Export singleton instance
export default new ApiInitService();