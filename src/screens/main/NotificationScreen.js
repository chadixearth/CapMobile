// screens/main/NotificationScreen.jsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import NotificationService from '../../services/notificationService';
import { useAuth } from '../../hooks/useAuth';

const MAROON = '#6B2E2B';
const MAROON_LIGHT = '#F5E9E2';
const TEXT = '#222';
const MUTED = '#777';

export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    if (!user?.id) return;
    
    const result = await NotificationService.getNotifications(user.id);
    if (result.success) {
      setNotifications(result.data || []);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    for (const notification of unreadNotifications) {
      await NotificationService.markAsRead(notification.id);
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markAsRead = async (notificationId) => {
    await NotificationService.markAsRead(notificationId);
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };

  return (
    <View style={styles.container}>
      {/* Back button – matches your provided design */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Header: centered title + action on right */}
      <View style={styles.headerBar}>
        <Text style={styles.title}>Notifications</Text>

        <TouchableOpacity style={styles.markAllBtn} onPress={markAllAsRead}>
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <NotificationItem 
            {...item} 
            onPress={() => markAsRead(item.id)}
          />
        )}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
}

function NotificationItem({ title, message, created_at, read, type, onPress }) {
  const getIcon = () => {
    switch (type) {
      case 'booking': return 'calendar-account';
      case 'booking_accepted': return 'check-circle';
      default: return 'bell';
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  return (
    <TouchableOpacity 
      style={[styles.itemRow, !read && styles.unreadItem]} 
      onPress={onPress}
    >
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name={getIcon()} size={22} color={MAROON} />
      </View>
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemTime}>{formatTime(created_at)}</Text>
        </View>
        <Text style={styles.itemMessage} numberOfLines={2}>{message}</Text>
        {!read && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
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
  unreadItem: {
    backgroundColor: '#f8f9fa',
  },
  unreadDot: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: MUTED,
    fontSize: 16,
  },
});
