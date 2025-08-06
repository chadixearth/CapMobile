import React from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';
import GoogleMap from '../../components/GoogleMap';
import BackButton from '../../components/BackButton';

const DEFAULT_REGION = {
  latitude: 10.3157,
  longitude: 123.8854,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const markers = [
  {
    latitude: 10.3157,
    longitude: 123.8854,
    title: 'Metro Cebu',
    description: 'Metro Cebu, Philippines'
  }
];

const MapViewScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={styles.header}>Map View</Text>
      <View style={styles.mapContainer}>
        <GoogleMap region={DEFAULT_REGION} markers={markers} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    margin: 16,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
});

export default MapViewScreen;
