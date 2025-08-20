import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BackButton from '../../components/BackButton';

const notifications = [
  {
    id: '1',
    title: 'Announcement',
    message: 'Customer A booked the photo shoot in events see bookings for more details.',
    time: '01:51',
  },
  {
    id: '2',
    title: 'Announcement',
    message: 'You declined the wedding shoot booking. See booking history for more details',
    time: '01:52',
  },
  {
    id: '3',
    title: 'Announcement',
    message: 'Customer A booked the photo shoot in events see bookings for more details.',
    time: '02:11',
  },
];

export default function NotificationScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={styles.title}>Notifications</Text>
      <TouchableOpacity style={styles.markAllBtn}>
        <Text style={styles.markAllText}>Mark all as read</Text>
      </TouchableOpacity>
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <NotificationItem {...item} />}
        contentContainerStyle={{ paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function NotificationItem({ title, message, time }) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name="calendar-account" size={28} color="#6B2E2B" />
      </View>
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemTime}>{time}</Text>
        </View>
        <Text style={styles.itemMessage}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA', paddingTop: 40, paddingHorizontal: 0 },
  backBtn: { position: 'absolute', top: 44, left: 18, zIndex: 10, backgroundColor: '#fff', borderRadius: 20, padding: 4, elevation: 2 },
  title: { fontSize: 28, fontWeight: 'bold', marginTop: 48, marginBottom: 18, color: '#222', marginLeft: 24 },
  markAllBtn: { position: 'absolute', right: 24, top: 56 },
  markAllText: { color: '#6B2E2B', fontWeight: '500', fontSize: 14 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24, marginHorizontal: 24 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8DAD6', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  itemContent: { flex: 1 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTitle: { fontWeight: 'bold', fontSize: 16, color: '#222' },
  itemTime: { color: '#aaa', fontSize: 13, marginLeft: 8 },
  itemMessage: { color: '#444', fontSize: 14, marginTop: 2 },
});
