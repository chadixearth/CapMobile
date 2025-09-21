// Global data invalidation service for automatic re-rendering
import { emit, on, off } from './eventBus';

// Data change events
export const DATA_EVENTS = {
  BOOKING_CHANGED: 'BOOKING_CHANGED',
  RIDE_CHANGED: 'RIDE_CHANGED',
  PACKAGE_CHANGED: 'PACKAGE_CHANGED',
  NOTIFICATION_CHANGED: 'NOTIFICATION_CHANGED',
  EARNINGS_CHANGED: 'EARNINGS_CHANGED',
  SCHEDULE_CHANGED: 'SCHEDULE_CHANGED',
  CUSTOM_REQUEST_CHANGED: 'CUSTOM_REQUEST_CHANGED',
  PAYMENT_CHANGED: 'PAYMENT_CHANGED',
  PROFILE_CHANGED: 'PROFILE_CHANGED',
  CARRIAGE_CHANGED: 'CARRIAGE_CHANGED',
  REVIEW_CHANGED: 'REVIEW_CHANGED',
  MAP_DATA_CHANGED: 'MAP_DATA_CHANGED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
};

// Emit data change events
export const invalidateData = {
  bookings: () => emit(DATA_EVENTS.BOOKING_CHANGED),
  rides: () => emit(DATA_EVENTS.RIDE_CHANGED),
  packages: () => emit(DATA_EVENTS.PACKAGE_CHANGED),
  notifications: () => emit(DATA_EVENTS.NOTIFICATION_CHANGED),
  earnings: () => emit(DATA_EVENTS.EARNINGS_CHANGED),
  schedule: () => emit(DATA_EVENTS.SCHEDULE_CHANGED),
  customRequests: () => emit(DATA_EVENTS.CUSTOM_REQUEST_CHANGED),
  payments: () => emit(DATA_EVENTS.PAYMENT_CHANGED),
  profile: () => emit(DATA_EVENTS.PROFILE_CHANGED),
  carriages: () => emit(DATA_EVENTS.CARRIAGE_CHANGED),
  reviews: () => emit(DATA_EVENTS.REVIEW_CHANGED),
  mapData: () => emit(DATA_EVENTS.MAP_DATA_CHANGED),
  userStatus: () => emit(DATA_EVENTS.USER_STATUS_CHANGED),
  // Convenience methods
  all: () => {
    Object.values(DATA_EVENTS).forEach(event => emit(event));
  },
};

// Subscribe to data changes
export const subscribeToDataChanges = (eventType, callback) => {
  return on(eventType, callback);
};

// Helper to use predefined screen event combinations
export const useScreenAutoRefresh = (screenType, refreshCallback) => {
  const eventTypes = SCREEN_EVENTS[screenType] || [];
  const React = require('react');
  const isActiveRef = React.useRef(true);
  
  // Disable auto-refresh when screen is not focused
  React.useEffect(() => {
    const unsubscribe = () => {
      isActiveRef.current = false;
    };
    
    return unsubscribe;
  }, []);
  
  const debouncedCallback = React.useCallback(() => {
    if (isActiveRef.current) {
      refreshCallback();
    }
  }, [refreshCallback]);
  
  return useAutoRefresh(debouncedCallback, eventTypes);
};

// Auto-refresh hook for screens with debouncing
export const useAutoRefresh = (refreshCallback, eventTypes = []) => {
  const React = require('react');
  const timeoutRef = React.useRef(null);
  const lastRefreshRef = React.useRef(0);
  
  React.useEffect(() => {
    const debouncedRefresh = () => {
      const now = Date.now();
      // Prevent refreshes more than once every 2 seconds
      if (now - lastRefreshRef.current < 2000) {
        return;
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastRefreshRef.current = Date.now();
        refreshCallback();
      }, 500); // 500ms debounce
    };
    
    const unsubscribers = eventTypes.map(eventType => 
      subscribeToDataChanges(eventType, debouncedRefresh)
    );
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      unsubscribers.forEach(unsub => unsub());
    };
  }, [refreshCallback, eventTypes]);
};

// Common event combinations for different screen types
export const SCREEN_EVENTS = {
  TOURIST_HOME: [DATA_EVENTS.PACKAGE_CHANGED, DATA_EVENTS.BOOKING_CHANGED, DATA_EVENTS.NOTIFICATION_CHANGED],
  DRIVER_BOOK: [DATA_EVENTS.BOOKING_CHANGED, DATA_EVENTS.RIDE_CHANGED, DATA_EVENTS.NOTIFICATION_CHANGED, DATA_EVENTS.EARNINGS_CHANGED],
  BOOK_SCREEN: [DATA_EVENTS.BOOKING_CHANGED, DATA_EVENTS.PAYMENT_CHANGED, DATA_EVENTS.NOTIFICATION_CHANGED],
  EARNINGS: [DATA_EVENTS.EARNINGS_CHANGED, DATA_EVENTS.BOOKING_CHANGED, DATA_EVENTS.RIDE_CHANGED],
  PROFILE: [DATA_EVENTS.PROFILE_CHANGED, DATA_EVENTS.USER_STATUS_CHANGED],
  CUSTOM_REQUESTS: [DATA_EVENTS.CUSTOM_REQUEST_CHANGED, DATA_EVENTS.NOTIFICATION_CHANGED],
  MAP_VIEW: [DATA_EVENTS.MAP_DATA_CHANGED, DATA_EVENTS.RIDE_CHANGED],
  NOTIFICATIONS: [DATA_EVENTS.NOTIFICATION_CHANGED],
  REVIEWS: [DATA_EVENTS.REVIEW_CHANGED, DATA_EVENTS.BOOKING_CHANGED],
  CARRIAGES: [DATA_EVENTS.CARRIAGE_CHANGED, DATA_EVENTS.PROFILE_CHANGED],
};