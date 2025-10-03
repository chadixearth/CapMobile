import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LocationService from '../services/locationService';

const DriverStatusIndicator = ({ driverId }) => {
  const [status, setStatus] = useState({ isActive: false, minutesAgo: null });

  useEffect(() => {
    if (!driverId) return;

    const checkStatus = async () => {
      const locationStatus = await LocationService.getLocationSharingStatus(driverId);
      setStatus(locationStatus);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [driverId]);

  if (!driverId) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.indicator, status.isActive ? styles.active : styles.inactive]} />
      <Text style={styles.text}>
        {status.isActive 
          ? 'Receiving ride requests' 
          : 'Not receiving ride requests'}
      </Text>
      {status.minutesAgo !== null && (
        <Text style={styles.subText}>
          Last location: {status.minutesAgo}m ago
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginVertical: 4,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  active: {
    backgroundColor: '#28a745',
  },
  inactive: {
    backgroundColor: '#dc3545',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  subText: {
    fontSize: 10,
    color: '#6c757d',
  },
});

export default DriverStatusIndicator;