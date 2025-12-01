import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import LocationService from '../services/locationService';
import { getSession } from '../services/authService';

const PublicLocationToggle = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    loadUser();
    checkStatus();
  }, []);

  const loadUser = async () => {
    const session = await getSession();
    if (session?.user) {
      setUserId(session.user.id);
    }
  };

  const checkStatus = () => {
    setIsEnabled(LocationService.isLocationTrackingActive());
  };

  const toggleLocation = async (value) => {
    if (value) {
      const success = await LocationService.startDriverLocationTracking(userId, 'driver');
      setIsEnabled(success);
    } else {
      LocationService.stopTracking();
      setIsEnabled(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>🐎 Share Location Publicly</Text>
      <Switch
        value={isEnabled}
        onValueChange={toggleLocation}
        trackColor={{ false: '#ccc', true: '#4CAF50' }}
        thumbColor={isEnabled ? '#fff' : '#f4f3f4'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});

export default PublicLocationToggle;
