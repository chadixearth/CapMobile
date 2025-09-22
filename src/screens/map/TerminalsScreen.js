import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LeafletMapView from '../../components/LeafletMapView';
import BackButton from '../../components/BackButton';
import RideStatusCard from '../../components/RideStatusCard';
import { getMyActiveRides } from '../../services/rideHailingService';
import { getCurrentUser } from '../../services/authService';

const TERMINALS = [
  { id: '1', name: 'Plaza Independencia', latitude: 10.2926, longitude: 123.9058 },
  { id: '2', name: 'Carbon Market', latitude: 10.2956, longitude: 123.8772 },
  { id: '3', name: 'SM City Cebu', latitude: 10.3111, longitude: 123.9164 },
  { id: '4', name: 'Ayala Center Cebu', latitude: 10.3173, longitude: 123.9058 },
];

const DEFAULT_REGION = {
  latitude: 10.307,
  longitude: 123.9,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

const TerminalsScreen = ({ navigation, route }) => {
  const type = route?.params?.type || 'pickup';
  const [selectedId, setSelectedId] = useState(null);
  const [activeRides, setActiveRides] = useState([]);
  const [showRides, setShowRides] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchActiveRides();
  }, []);

  const fetchActiveRides = async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (user?.id) {
        const result = await getMyActiveRides(user.id);
        if (result.success) {
          setActiveRides(result.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching active rides:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRideRefresh = (updatedRide) => {
    setActiveRides(prev => 
      prev.map(ride => ride.id === updatedRide.id ? updatedRide : ride)
    );
  };

  const handleMarkerPress = (terminal) => {
    setSelectedId(terminal.id);
    navigation.navigate('Home', { selectedTerminal: terminal, type });
  };

  const isTab = navigation.getState && navigation.getState().routes[navigation.getState().index]?.name === 'Terminals';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[styles.toggleButton, !showRides && styles.activeToggle]}
          onPress={() => setShowRides(false)}
        >
          <Ionicons name="location-outline" size={20} color={!showRides ? '#fff' : '#6B2E2B'} />
          <Text style={[styles.toggleText, !showRides && styles.activeToggleText]}>Terminals</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleButton, showRides && styles.activeToggle]}
          onPress={() => setShowRides(true)}
        >
          <Ionicons name="car-outline" size={20} color={showRides ? '#fff' : '#6B2E2B'} />
          <Text style={[styles.toggleText, showRides && styles.activeToggleText]}>My Rides</Text>
          {activeRides.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeRides.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {showRides ? (
        <ScrollView style={styles.ridesContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading rides...</Text>
            </View>
          ) : activeRides.length > 0 ? (
            activeRides.map(ride => (
              <RideStatusCard 
                key={ride.id} 
                ride={ride} 
                onRefresh={handleRideRefresh}
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={48} color="#8E8E93" />
              <Text style={styles.emptyText}>No active rides</Text>
              <Text style={styles.emptySubtext}>Book a ride from the Home screen</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.mapContainer}>
          <LeafletMapView
            region={DEFAULT_REGION}
            markers={TERMINALS.map(t => ({
              latitude: t.latitude,
              longitude: t.longitude,
              title: t.name,
              description: `Tap to select as ${type}`,
              id: t.id,
              pointType: 'terminal',
              iconColor: selectedId === t.id ? '#6B2E2B' : '#00AA00',
            }))}
            roads={[]}
            routes={[]}
            showSatellite={false}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    margin: 16,
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 6,
    position: 'relative',
  },
  activeToggle: {
    backgroundColor: '#6B2E2B',
  },
  toggleText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#6B2E2B',
  },
  activeToggleText: {
    color: '#fff',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ridesContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
  },
});

export default TerminalsScreen;
