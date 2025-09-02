import React, { useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';
import LeafletMapView from '../../components/LeafletMapView';
import BackButton from '../../components/BackButton';

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

  const handleMarkerPress = (terminal) => {
    setSelectedId(terminal.id);
    navigation.navigate('Home', { selectedTerminal: terminal, type });
  };

  const isTab = navigation.getState && navigation.getState().routes[navigation.getState().index]?.name === 'Terminals';

  return (
    <SafeAreaView style={styles.container}>
      
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B2E2B',
    textAlign: 'center',
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
