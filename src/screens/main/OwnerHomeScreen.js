import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function OwnerHomeScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.header}>
        <Text style={styles.logo}>TARTRACK</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Notification')}>
            <Ionicons name="notifications-outline" size={22} color="#222" style={styles.icon} />
          </TouchableOpacity>
          <Ionicons name="person-circle-outline" size={26} color="#222" style={styles.icon} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Owner Dashboard</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Overview</Text>
        <Text style={styles.cardText}>Manage your fleet, drivers, and bookings.</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.smallCard}>
          <Ionicons name="bus-outline" size={22} color="#6B2E2B" />
          <Text style={styles.smallCardLabel}>Vehicles</Text>
          <Text style={styles.smallCardValue}>5</Text>
        </View>
        <View style={styles.smallCard}>
          <Ionicons name="people-outline" size={22} color="#6B2E2B" />
          <Text style={styles.smallCardLabel}>Drivers</Text>
          <Text style={styles.smallCardValue}>12</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.smallCard}>
          <Ionicons name="wallet-outline" size={22} color="#6B2E2B" />
          <Text style={styles.smallCardLabel}>Earnings</Text>
          <Text style={styles.smallCardValue}>₱ 12,340</Text>
        </View>
        <View style={styles.smallCard}>
          <Ionicons name="list-outline" size={22} color="#6B2E2B" />
          <Text style={styles.smallCardLabel}>Bookings</Text>
          <Text style={styles.smallCardValue}>27</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  logo: { fontSize: 24, fontWeight: 'bold', color: '#7B3F00', letterSpacing: 1 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginLeft: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#222', marginLeft: 18, marginTop: 10, marginBottom: 6 },
  card: {
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#222', marginBottom: 4 },
  cardText: { color: '#555' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16 },
  smallCard: {
    flex: 1,
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    padding: 16,
    marginRight: 8,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  smallCardLabel: { color: '#888', marginTop: 6 },
  smallCardValue: { fontSize: 18, fontWeight: 'bold', color: '#222', marginTop: 4 },
});


