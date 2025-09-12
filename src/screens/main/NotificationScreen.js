// screens/main/NotificationScreen.jsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, AppState, Badge } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../hooks/useAuth';

const MAROON = '#6B2E2B';
const MAROON_LIGHT = '#F5E9E2';
const TEXT = '#222';
const MUTED = '#777';

export default function NotificationScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false);
  const { notifications, unreadCount, loadNotifications, markAsRead, markAllAsRead } = useNotifications();
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);
  
  useEffect(() => {
    loadNotifications();

    // Handle app state changes
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground, refresh notifications
        loadNotifications();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = (notification) => {
    markAsRead(notification.id);
    
    // Navigate based on notification type
    if (notification.type === 'booking' && (user?.role === 'driver' || user?.role === 'driver-owner')) {
      navigation.navigate('DriverBook');
    } else if (notification.type === 'booking_accepted' && user?.role === 'tourist') {
      navigation.navigate('BookScreen');
    }
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

        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <NotificationItem 
            {...item} 
            onPress={() => handleNotificationPress(item)}
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
      case 'booking': return 'car';
      case 'booking_accepted': return 'check-circle';
      case 'payment': return 'credit-card';
      default: return 'bell';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'booking': return '#2196F3';
      case 'booking_accepted': return '#4CAF50';
      case 'payment': return '#FF9800';
      default: return MAROON;
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
      <View style={[styles.iconCircle, { backgroundColor: getIconColor() + '20' }]}>
        <MaterialCommunityIcons name={getIcon()} size={22} color={getIconColor()} />
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
  headerActions: {
    position: 'absolute',
    right: 24,
    top: 75,
    transform: [{ translateY: -10 }],
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  markAllBtn: {
    padding: 4,
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
