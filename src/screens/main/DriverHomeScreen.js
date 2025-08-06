import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const notifications = [
  {
    id: '1',
    icon: <MaterialCommunityIcons name="calendar-account" size={24} color="#6B2E2B" />,
    message: "+ You've earned ₱ 50.00 from your tour",
    time: '11:11',
  },
  {
    id: '2',
    icon: <Ionicons name="checkmark-circle" size={24} color="#6B2E2B" />,
    message: 'You accepted a customer ride',
    time: '11:30',
  },
];

export default function DriverHomeScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>TARTRACK</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Notification')}>
            <Ionicons name="notifications-outline" size={22} color="#222" style={styles.icon} />
          </TouchableOpacity>
          <Ionicons name="person-circle-outline" size={26} color="#222" style={styles.icon} />
        </View>
      </View>

      {/* Income Card */}
      <View style={styles.incomeCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={styles.incomeLabel}>Income</Text>
          <View style={styles.incomeStat}>
            <Ionicons name="trending-up-outline" size={14} color="#2ecc71" />
            <Text style={styles.incomeStatText}>+7.2%</Text>
          </View>
          <Text style={styles.incomeHigher}>Higher</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.incomeAmount}>₱ 1,500.00</Text>
          <TouchableOpacity style={styles.incomeArrow}>
            <Ionicons name="arrow-forward-circle" size={28} color="#bbb" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Latest Notifications */}
      <Text style={styles.sectionTitle}>Latest Notifications</Text>
      {notifications.map((notif) => (
        <View key={notif.id} style={styles.notifCard}>
          <View style={styles.notifIcon}>{notif.icon}</View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifMsg}>{notif.message}</Text>
          </View>
          <Text style={styles.notifTime}>{notif.time}</Text>
        </View>
      ))}

      {/* Data Analytics */}
      <Text style={styles.sectionTitle}>Data Analytics</Text>
      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsLabel}>Activity</Text>
        {/* Placeholder for bar chart */}
        <View style={styles.barChartPlaceholder}>
          {/* You can replace this with a real chart later */}
          <Image source={{ uri: 'https://dummyimage.com/300x80/ededed/aaa&text=Bar+Chart' }} style={{ width: '100%', height: 80, borderRadius: 8 }} />
        </View>
        <Text style={styles.analyticsMonth}>Month</Text>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B2E2B',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 40,
  },
  searchInput: { flex: 1, color: '#fff', marginLeft: 8 },
  incomeCard: {
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
  incomeLabel: { fontWeight: 'bold', color: '#2ecc71', marginRight: 8 },
  incomeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eafaf1',
    borderRadius: 8,
    paddingHorizontal: 6,
    marginRight: 8,
    marginLeft: 2,
  },
  incomeStatText: { color: '#2ecc71', fontSize: 12, fontWeight: 'bold', marginLeft: 2 },
  incomeHigher: { color: '#888', fontSize: 12, marginLeft: 2 },
  incomeAmount: { fontSize: 28, fontWeight: 'bold', color: '#222', flex: 1 },
  incomeArrow: { marginLeft: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#222', marginLeft: 18, marginTop: 10, marginBottom: 6 },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  notifIcon: { marginRight: 12 },
  notifMsg: { color: '#222', fontSize: 14, fontWeight: '500' },
  notifTime: { color: '#aaa', fontSize: 12, marginLeft: 8 },
  analyticsCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  analyticsLabel: { fontWeight: 'bold', color: '#222', marginBottom: 8, alignSelf: 'flex-start' },
  barChartPlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: '#ededed',
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  analyticsMonth: { color: '#888', fontSize: 12, alignSelf: 'flex-end', marginTop: 2 },
});
