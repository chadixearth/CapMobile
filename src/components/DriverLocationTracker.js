import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import LocationService from '../services/locationService';
import { getSession } from '../services/authService';

const DriverLocationTracker = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [user, setUser] = useState(null);
  const [lastLocation, setLastLocation] = useState(null);

  useEffect(() => {
    loadUser();
    checkTrackingStatus();
    
    return () => {
      // Clean up location tracking when component unmounts
      if (isTracking) {
        LocationService.stopTracking();
      }
    };
  }, []);

  const loadUser = async () => {
    try {
      const session = await getSession();
      if (session?.user) {
        setUser(session.user);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const checkTrackingStatus = () => {
    const trackingActive = LocationService.isLocationTrackingActive();
    setIsTracking(trackingActive);
  };

  const startLocationTracking = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to start location tracking');
      return;
    }

    try {
      const success = await LocationService.startDriverLocationTracking(user.id);
      
      if (success) {
        setIsTracking(true);
        Alert.alert('Success', 'Location tracking started. You will now receive ride requests based on your location.');
      } else {
        Alert.alert('Error', 'Failed to start location tracking. Please check your location permissions.');
      }
    } catch (error) {
      console.error('Error starting location tracking:', error);
      Alert.alert('Error', 'Failed to start location tracking');
    }
  };

  const stopLocationTracking = () => {
    LocationService.stopTracking();
    setIsTracking(false);
    setLastLocation(null);
    Alert.alert('Stopped', 'Location tracking stopped. You will not receive new ride requests.');
  };

  const handleLocationUpdate = (location) => {
    setLastLocation(location);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver Location Tracking</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={[styles.statusText, isTracking ? styles.activeStatus : styles.inactiveStatus]}>
          {isTracking ? '🟢 Active' : '🔴 Inactive'}
        </Text>
      </View>

      {lastLocation && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationLabel}>Last Location:</Text>
          <Text style={styles.locationText}>
            Lat: {lastLocation.latitude?.toFixed(6)}
          </Text>
          <Text style={styles.locationText}>
            Lng: {lastLocation.longitude?.toFixed(6)}
          </Text>
          <Text style={styles.locationText}>
            Updated: {new Date(lastLocation.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        {!isTracking ? (
          <TouchableOpacity style={styles.startButton} onPress={startLocationTracking}>
            <Text style={styles.buttonText}>Start Location Tracking</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopButton} onPress={stopLocationTracking}>
            <Text style={styles.buttonText}>Stop Location Tracking</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>📍 How it works:</Text>
        <Text style={styles.infoText}>
          • When tracking is ON: You receive ride requests from nearby customers
        </Text>
        <Text style={styles.infoText}>
          • When tracking is OFF: You will NOT receive any ride notifications
        </Text>
        <Text style={styles.infoText}>
          • Closest drivers get priority for new ride requests
        </Text>
        <Text style={styles.infoText}>
          • Location updates every 15 seconds or 25 meters
        </Text>
      </View>
      
      {!isTracking && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            ⚠️ Location sharing is OFF. You will not receive ride booking notifications.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  activeStatus: {
    color: '#28a745',
  },
  inactiveStatus: {
    color: '#dc3545',
  },
  locationInfo: {
    backgroundColor: '#e9ecef',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#495057',
  },
  locationText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  buttonContainer: {
    marginBottom: 30,
  },
  startButton: {
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#dc3545',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#495057',
  },
  infoText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
    lineHeight: 20,
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default DriverLocationTracker;