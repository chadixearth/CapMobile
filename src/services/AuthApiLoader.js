import { checkAuthStatus } from './authService';

/**
 * Simple service to load authenticated APIs after login
 */
class AuthApiLoader {
  constructor() {
    this.cache = {};
    this.loading = false;
  }

  async loadUserData(userId) {
    if (this.loading) return this.cache;
    
    this.loading = true;
    console.log('[AuthApiLoader] Loading user data for:', userId);
    
    try {
      const authStatus = await checkAuthStatus();
      if (!authStatus.isLoggedIn) {
        throw new Error('User not authenticated');
      }

      // Load user-specific data based on role
      const userRole = authStatus.user.role;
      
      if (userRole === 'driver' || userRole === 'owner') {
        // Load carriages for drivers/owners
        try {
          const { carriageService } = await import('./tourpackage/fetchCarriage');
          this.cache.userCarriages = userRole === 'owner' 
            ? await carriageService.getByOwner(userId)
            : await carriageService.getByDriver(userId);
        } catch (error) {
          console.warn('[AuthApiLoader] Failed to load carriages:', error.message);
          this.cache.userCarriages = [];
        }

        // Load earnings for drivers only
        if (userRole === 'driver') {
          try {
            const { getDriverEarnings } = await import('./earningsService');
            this.cache.earnings = await getDriverEarnings(userId);
          } catch (error) {
            console.warn('[AuthApiLoader] Failed to load earnings:', error.message);
            this.cache.earnings = { success: true, data: { earnings: [], statistics: {} } };
          }
        }
      }

      // Load bookings for tourists only
      if (userRole === 'tourist') {
        try {
          const { getCustomerBookings } = await import('./tourpackage/requestBooking');
          this.cache.bookings = await getCustomerBookings(userId);
        } catch (error) {
          console.warn('[AuthApiLoader] Failed to load bookings:', error.message);
          this.cache.bookings = [];
        }
      }

      console.log('[AuthApiLoader] User data loaded successfully');
      return this.cache;
    } catch (error) {
      console.error('[AuthApiLoader] Failed to load user data:', error);
      return {};
    } finally {
      this.loading = false;
    }
  }

  getCache() {
    return this.cache;
  }

  clearCache() {
    this.cache = {};
    this.loading = false;
    console.log('[AuthApiLoader] Cache cleared');
  }
}

export default new AuthApiLoader();