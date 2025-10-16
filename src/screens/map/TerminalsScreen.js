import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LeafletMapView from '../../components/LeafletMapView';
import BackButton from '../../components/BackButton';
import RideStatusCard from '../../components/RideStatusCard';
import { getMyActiveRides } from '../../services/rideHailingService';
import { getCurrentUser } from '../../services/authService';
import { fetchTerminals, fetchMapData } from '../../services/map/fetchMap';

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
  const [terminals, setTerminals] = useState([]);
  const [mapData, setMapData] = useState(null);

  useEffect(() => {
    fetchActiveRides();
    loadMapData();
  }, []);

  const loadMapData = async () => {
    try {
      const [terminalData, fullMapData] = await Promise.all([
        fetchTerminals({ type: 'pickup', active: true }),
        fetchMapData({ cacheOnly: true })
      ]);
      
      setTerminals(terminalData.terminals || []);
      setMapData(fullMapData);
    } catch (error) {
      console.error('Error loading map data:', error);
      // Fallback to default terminals
      setTerminals([
        { id: '1', name: 'Plaza Independencia', latitude: 10.2926, longitude: 123.9058 },
        { id: '2', name: 'Carbon Market', latitude: 10.2956, longitude: 123.8772 },
        { id: '3', name: 'SM City Cebu', latitude: 10.3111, longitude: 123.9164 },
        { id: '4', name: 'Ayala Center Cebu', latitude: 10.3173, longitude: 123.9058 },
      ]);
    }
  };

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
    if (updatedRide.status === 'cancelled' || updatedRide.status === 'completed') {
      // Remove cancelled or completed rides from the list
      setActiveRides(prev => prev.filter(ride => ride.id !== updatedRide.id));
    } else {
      // Update existing ride
      setActiveRides(prev => 
        prev.map(ride => ride.id === updatedRide.id ? updatedRide : ride)
      );
    }
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
        <View style={styles.ridesContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6B2E2B" />
              <Text style={styles.loadingText}>Loading your ride...</Text>
            </View>
          ) : activeRides.length > 0 ? (
            <ScrollView 
              style={styles.ridesList}
              contentContainerStyle={styles.ridesContent}
              showsVerticalScrollIndicator={false}
            >
              {activeRides.map(ride => (
                <RideStatusCard 
                  key={ride.id} 
                  ride={ride} 
                  onRefresh={handleRideRefresh}
                />
              ))}
              
              <View style={styles.rideInfoCard}>
                <View style={styles.infoHeader}>
                  <Ionicons name="information-circle" size={24} color="#6B2E2B" />
                  <Text style={styles.infoTitle}>Ride Information</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="cash" size={16} color="#6B2E2B" />
                  <Text style={styles.infoText}>Payment: Cash only upon arrival</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="time" size={16} color="#6B2E2B" />
                  <Text style={styles.infoText}>Average wait time: 3-8 minutes</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="person" size={16} color="#6B2E2B" />
                  <Text style={styles.infoText}>One booking at a time allowed</Text>
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="car-outline" size={64} color="#6B2E2B" />
              </View>
              <Text style={styles.emptyText}>No Active Rides</Text>
              <Text style={styles.emptySubtext}>Book your first ride from the Home screen</Text>
              <TouchableOpacity 
                style={styles.bookRideButton}
                onPress={() => navigation.navigate('Home')}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.bookRideButtonText}>Book a Ride</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.mapContainer}>
          <LeafletMapView
            region={mapData?.config ? {
              latitude: mapData.config.center_latitude,
              longitude: mapData.config.center_longitude,
              latitudeDelta: 0.06,
              longitudeDelta: 0.06,
            } : DEFAULT_REGION}
            markers={terminals.map(t => ({
              latitude: parseFloat(t.latitude),
              longitude: parseFloat(t.longitude),
              title: t.name,
              description: `Tap to select as ${type}`,
              id: t.id,
              pointType: t.point_type || 'terminal',
              iconColor: selectedId === t.id ? '#6B2E2B' : '#00AA00',
            }))}
            roads={mapData?.roads || []}
            routes={mapData?.routes || []}
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
    backgroundColor: '#F8F9FA',
  },
  ridesList: {
    flex: 1,
  },
  ridesContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B2E2B',
    marginTop: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5E9E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  bookRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  bookRideButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  rideInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F0E7E3',
    shadowColor: '#6B2E2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
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
