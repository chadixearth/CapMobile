// screens/main/NotificationScreen.jsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const MAROON = '#6B2E2B';
const MAROON_LIGHT = '#F5E9E2';
const TEXT = '#222';
const MUTED = '#777';

const notifications = [
  { id: '1', title: 'Announcement', message: 'Customer A booked the photo shoot in events see bookings for more details.', time: '01:51' },
  { id: '2', title: 'Announcement', message: 'You declined the wedding shoot booking. See booking history for more details', time: '01:52' },
  { id: '3', title: 'Announcement', message: 'Customer A booked the photo shoot in events see bookings for more details.', time: '02:11' },
];

export default function NotificationScreen({ navigation }) {
  return (
    <View style={styles.container}>
      {/* Back button – matches your provided design */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Header: centered title + action on right */}
      <View style={styles.headerBar}>
        <Text style={styles.title}>Notifications</Text>

        <TouchableOpacity style={styles.markAllBtn}>
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NotificationItem {...item} />}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function NotificationItem({ title, message, time }) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name="calendar-account" size={22} color={MAROON} />
      </View>
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemTime}>{time}</Text>
        </View>
        <Text style={styles.itemMessage} numberOfLines={2}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA', paddingTop: 40 },

  // Back button (maroon, white arrow)
  backBtn: {
    backgroundColor: MAROON,
    borderRadius: 20,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    position: 'absolute',
    top: 44,
    left: 18,
    zIndex: 10,
  },

  /* Header */
  headerBar: {
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: 0.3,
  },
  markAllBtn: {
    position: 'absolute',
    right: 24,
    top: 75,
    transform: [{ translateY: -10 }],
  },
  markAllText: { color: MAROON, fontWeight: '800', fontSize: 13 },

  /* List items (sizes like Driver Booking Screen) */
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: MAROON_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemContent: { flex: 1 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTitle: { fontSize: 14, fontWeight: '800', color: TEXT },
  itemTime: { color: '#9A9A9A', fontSize: 12, marginLeft: 8 },
  itemMessage: { color: MUTED, fontSize: 12, marginTop: 2, lineHeight: 18 },
});
