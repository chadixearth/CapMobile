import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LocationService from '../services/locationService';

const MAROON = '#6B2E2B';
const GREEN = '#28a745';
const RED = '#dc3545';

export default function LocationTracker({ userId, onLocationUpdate }) {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      LocationService.stopTracking();
    };
  }, []);

  const startTracking = async () => {
    try {
      const success = await LocationService.startTracking(userId, (location) => {
        setCurrentLocation(location);
        setLastUpdate(new Date());
        if (onLocationUpdate) {
          onLocationUpdate(location);
        }
      });

      if (success) {
        setIsTracking(true);
        Alert.alert('Location Tracking', 'Real-time location tracking started');
      } else {
        Alert.alert('Error', 'Failed to start location tracking');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start location tracking: ' + error.message);
    }
  };

  const stopTracking = () => {
    LocationService.stopTracking();
    setIsTracking(false);
    setCurrentLocation(null);
    setLastUpdate(null);
    Alert.alert('Location Tracking', 'Location tracking stopped');
  };

  const getCurrentLocation = async () => {
    try {
      const location = await LocationService.getCurrentLocation();
      setCurrentLocation(location);
      Alert.alert('Current Location', `Lat: ${location.latitude.toFixed(6)}, Lng: ${location.longitude.toFixed(6)}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location: ' + error.message);
    }
  };

  const formatSpeed = (speed) => {
    if (!speed) return '0 km/h';
    return `${(speed * 3.6).toFixed(1)} km/h`; // Convert m/s to km/h
  };

  const formatTime = (date) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons 
          name="location" 
          size={24} 
          color={isTracking ? GREEN : MAROON} 
        />
        <Text style={styles.title}>Location Tracking</Text>
        <View style={[styles.status, { backgroundColor: isTracking ? GREEN : RED }]}>
          <Text style={styles.statusText}>
            {isTracking ? 'ACTIVE' : 'INACTIVE'}
          </Text>
        </View>
      </View>

      {currentLocation && (
        <View style={styles.locationInfo}>
          <Text style={styles.infoText}>
            📍 {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          </Text>
          <Text style={styles.infoText}>
            🚗 Speed: {formatSpeed(currentLocation.speed)}
          </Text>
          <Text style={styles.infoText}>
            🕒 Last Update: {formatTime(lastUpdate)}
          </Text>
        </View>
      )}

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={isTracking ? stopTracking : startTracking}
        >
          <Ionicons 
            name={isTracking ? "stop" : "play"} 
            size={20} 
            color="white" 
          />
          <Text style={styles.buttonText}>
            {isTracking ? 'Stop Tracking' : 'Start Tracking'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={getCurrentLocation}
        >
          <Ionicons name="locate" size={20} color={MAROON} />
          <Text style={[styles.buttonText, { color: MAROON }]}>
            Get Location
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginLeft: 8,
  },
  status: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  locationInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: MAROON,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: MAROON,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});