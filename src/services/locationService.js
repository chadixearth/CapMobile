import * as Location from 'expo-location';
import { supabase } from './supabase';
import { Alert } from 'react-native';

class LocationService {
  static locationWatcher = null;
  static isTracking = false;

  // Request location permissions
  static async requestPermissions() {
    try {
      // Check if location services are enabled first
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings to use ride hailing features.',
          [{ text: 'OK' }]
        );
        return false;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'This app needs location access to provide real-time tracking for bookings. Please enable location permissions in your device settings.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      Alert.alert(
        'Location Error',
        'Unable to access location services. Please check your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }

  // Start real-time location tracking
  static async startTracking(userId, onLocationUpdate) {
    if (this.isTracking) {
      console.log('Location tracking already active');
      return true;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return false;

    try {
      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        console.log('Location services are disabled');
        return false;
      }

      this.locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced, // Use balanced instead of high for better compatibility
          timeInterval: 15000, // Update every 15 seconds
          distanceInterval: 25, // Update every 25 meters
        },
        async (location) => {
          const { latitude, longitude, speed, heading } = location.coords;
          console.log(`[LocationService] New location for ${userId}:`, { latitude, longitude, speed, heading });
          
          try {
            // Update location via API
            const { updateDriverLocation } = await import('./rideHailingService');
            const result = await updateDriverLocation(userId, latitude, longitude, speed || 0, heading || 0);
            console.log(`[LocationService] Location update result:`, result);

            // Call callback if provided
            if (onLocationUpdate) {
              onLocationUpdate({
                latitude,
                longitude,
                speed,
                heading,
                timestamp: location.timestamp,
              });
            }
          } catch (error) {
            console.error('Error updating location:', error);
          }
        }
      );

      this.isTracking = true;
      console.log('Location tracking started for user:', userId);
      return true;
    } catch (error) {
      console.log('Location tracking failed silently:', error.message);
      return false;
    }
  }

  // Stop location tracking
  static stopTracking() {
    if (this.locationWatcher) {
      this.locationWatcher.remove();
      this.locationWatcher = null;
      this.isTracking = false;
      console.log('Location tracking stopped - driver will not receive ride notifications');
    }
  }

  // Get current location once
  static async getCurrentLocation() {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Location services are not enabled or permission denied. Please enable location services in your device settings.');
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 15000,
        maximumAge: 10000,
      });
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        speed: location.coords.speed || 0,
        heading: location.coords.heading || 0,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      if (error.code === 'E_LOCATION_SERVICES_DISABLED') {
        throw new Error('Location services are disabled. Please enable location services in your device settings.');
      } else if (error.code === 'E_LOCATION_UNAVAILABLE') {
        throw new Error('Unable to determine your location. Please try again or enter your location manually.');
      } else if (error.code === 'E_LOCATION_TIMEOUT') {
        throw new Error('Location request timed out. Please try again.');
      }
      throw new Error('Error fetching current location. Make sure that location services are enabled.');
    }
  }

  // Get driver locations for tracking
  static async getDriverLocations(driverIds = []) {
    try {
      // Use API instead of direct Supabase query
      const { getDriverLocation } = await import('./rideHailingService');
      
      if (driverIds.length > 0) {
        const locations = await Promise.all(
          driverIds.map(async (driverId) => {
            const result = await getDriverLocation(driverId);
            return result.success ? result.data : null;
          })
        );
        return locations.filter(loc => loc !== null);
      } else {
        // Get all driver locations via API
        const { apiRequest } = await import('./authService');
        console.log('[LocationService] Fetching all driver locations from API...');
        const result = await apiRequest('/location/drivers/');
        console.log('[LocationService] API response:', {
          success: result.success,
          dataType: typeof result.data,
          isArray: Array.isArray(result.data),
          dataLength: result.data?.length,
          sampleData: result.data?.[0]
        });
        
        if (result.success && result.data) {
          // Handle nested data structure
          let locations = [];
          if (Array.isArray(result.data.data)) {
            locations = result.data.data;
          } else if (Array.isArray(result.data)) {
            locations = result.data;
          }
          
          console.log('[LocationService] Processed locations:', locations.length);
          return locations;
        }
        
        return [];
      }
    } catch (error) {
      console.error('Error getting driver locations:', error);
      return [];
    }
  }
  
  // Check if location tracking is active
  static isLocationTrackingActive() {
    return this.isTracking && this.locationWatcher !== null;
  }
  
  // Get location sharing status for driver
  static async getLocationSharingStatus(driverId) {
    try {
      const { apiRequest } = await import('./authService');
      const result = await apiRequest(`/location/drivers/?driver_id=${driverId}`);
      
      if (result.success && result.data && result.data.length > 0) {
        const location = result.data[0];
        const lastUpdate = new Date(location.updated_at);
        const now = new Date();
        const minutesAgo = (now - lastUpdate) / (1000 * 60);
        
        // Consider location sharing active if updated within last 10 minutes
        return {
          isActive: minutesAgo <= 10,
          lastUpdate: lastUpdate,
          minutesAgo: Math.round(minutesAgo)
        };
      }
      
      return { isActive: false, lastUpdate: null, minutesAgo: null };
    } catch (error) {
      console.error('Error checking location sharing status:', error);
      return { isActive: false, lastUpdate: null, minutesAgo: null };
    }
  }

  // Calculate distance between two points
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  }

  static toRadians(degrees) {
    return degrees * (Math.PI/180);
  }

  // Find nearest drivers with availability check
  static async findNearestDrivers(latitude, longitude, radiusKm = 10) {
    try {
      const allDrivers = await this.getDriverLocations();
      
      const nearbyDrivers = allDrivers
        .map(driver => ({
          ...driver,
          distance: this.calculateDistance(
            latitude, 
            longitude, 
            parseFloat(driver.latitude), 
            parseFloat(driver.longitude)
          )
        }))
        .filter(driver => driver.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance);

      return nearbyDrivers;
    } catch (error) {
      console.error('Error finding nearest drivers:', error);
      return [];
    }
  }
  
  // Start location tracking for drivers automatically
  static async startDriverLocationTracking(userId) {
    try {
      const success = await this.startTracking(userId, (location) => {
        console.log(`[LocationService] Driver ${userId} location updated:`, location);
      });
      
      if (success) {
        console.log(`[LocationService] Started location tracking for driver ${userId}`);
      } else {
        console.warn(`[LocationService] Failed to start location tracking for driver ${userId}`);
      }
      
      return success;
    } catch (error) {
      console.error('Error starting driver location tracking:', error);
      return false;
    }
  }
}

export default LocationService;