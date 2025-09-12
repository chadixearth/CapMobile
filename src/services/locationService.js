import * as Location from 'expo-location';
import { supabase } from './supabase';
import { Alert } from 'react-native';

class LocationService {
  static locationWatcher = null;
  static isTracking = false;

  // Request location permissions
  static async requestPermissions() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'This app needs location access to provide real-time tracking for bookings.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
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
      this.locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        async (location) => {
          const { latitude, longitude, speed, heading } = location.coords;
          
          try {
            // Update location in database
            await supabase
              .from('driver_locations')
              .upsert({
                user_id: userId,
                latitude,
                longitude,
                speed: speed || 0,
                heading: heading || 0,
                updated_at: new Date().toISOString(),
              });

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
            console.error('Error updating location in database:', error);
          }
        }
      );

      this.isTracking = true;
      console.log('Location tracking started for user:', userId);
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  // Stop location tracking
  static stopTracking() {
    if (this.locationWatcher) {
      this.locationWatcher.remove();
      this.locationWatcher = null;
      this.isTracking = false;
      console.log('Location tracking stopped');
    }
  }

  // Get current location once
  static async getCurrentLocation() {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) throw new Error('Location permission denied');

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
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
      throw error;
    }
  }

  // Get driver locations for tracking
  static async getDriverLocations(driverIds = []) {
    try {
      let query = supabase
        .from('driver_locations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (driverIds.length > 0) {
        query = query.in('user_id', driverIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting driver locations:', error);
      return [];
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

  // Find nearest drivers
  static async findNearestDrivers(latitude, longitude, radiusKm = 5) {
    try {
      const allDrivers = await this.getDriverLocations();
      
      const nearbyDrivers = allDrivers
        .map(driver => ({
          ...driver,
          distance: this.calculateDistance(
            latitude, 
            longitude, 
            driver.latitude, 
            driver.longitude
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
}

export default LocationService;