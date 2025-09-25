import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const LocationStatusIndicator = ({ isTracking, lastUpdateTime, error }) => {
  const getStatusColor = () => {
    if (error) return '#ff4444';
    if (isTracking) return '#00aa00';
    return '#888888';
  };

  const getStatusText = () => {
    if (error) return 'Location Error';
    if (isTracking) return 'Location Active';
    return 'Location Inactive';
  };

  return (
    <View style={styles.container}>
      <View style={[styles.indicator, { backgroundColor: getStatusColor() }]} />
      <Text style={styles.text}>{getStatusText()}</Text>
      {lastUpdateTime && (
        <Text style={styles.timeText}>
          Last: {new Date(lastUpdateTime).toLocaleTimeString()}
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
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    margin: 4,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
});

export default LocationStatusIndicator;