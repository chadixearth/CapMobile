// screens/main/NotificationScreen.jsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, AppState, Badge } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { useScreenAutoRefresh } from '../../services/dataInvalidationService';
import * as Routes from '../../constants/routes';

const MAROON = '#6B2E2B';
const MAROON_LIGHT = '#F5E9E2';
const TEXT = '#222';
const MUTED = '#777';

export default function NotificationScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false);
  const { notifications, unreadCount, loadNotifications, markAsRead, markAllAsRead } = useNotifications();
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);
  
  // Auto-refresh when notification data changes
  useScreenAutoRefresh('NOTIFICATIONS', () => {
    console.log('[NotificationScreen] Auto-refreshing due to data changes');
    loadNotifications();
  });

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
    
    const title = notification.title?.toLowerCase() || '';
    const message = notification.message?.toLowerCase() || '';
    const userRole = user?.role;
    
    // Only navigate for specific actionable notifications
    try {
      if (title.includes('booking') || title.includes('request') || message.includes('booking')) {
        if (userRole === 'tourist') {
          navigation.navigate(Routes.BOOK);
        } else if (userRole === 'driver' || userRole === 'driver-owner') {
          navigation.navigate(Routes.BOOKINGS);
        } else if (userRole === 'owner') {
          navigation.navigate(Routes.BOOKINGS);
        }
      } else if (title.includes('payment') || title.includes('earning') || message.includes('payment')) {
        if (userRole === 'driver' || userRole === 'driver-owner') {
          navigation.navigate(Routes.BREAKEVEN);
        } else if (userRole === 'tourist') {
          navigation.navigate(Routes.BOOK);
        }
      } else if (title.includes('ride') || message.includes('ride')) {
        if (userRole === 'tourist') {
          navigation.navigate(Routes.BOOK);
        } else if (userRole === 'driver' || userRole === 'driver-owner') {
          navigation.navigate(Routes.BOOKINGS);
        }
      }
      // For announcements, updates, or other non-actionable notifications, just mark as read without navigation
    } catch (error) {
      console.log('Navigation not available for this notification type');
      // Silently handle navigation errors - notification is already marked as read
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
    const titleLower = title?.toLowerCase() || '';
    if (titleLower.includes('booking') || titleLower.includes('request')) return 'calendar';
    if (titleLower.includes('payment') || titleLower.includes('earning')) return 'credit-card';
    if (titleLower.includes('driver')) return 'account';
    if (titleLower.includes('carriage')) return 'car';
    if (titleLower.includes('completed') || titleLower.includes('accepted')) return 'check-circle';
    if (titleLower.includes('cancelled') || titleLower.includes('cancel')) return 'close-circle';
    if (titleLower.includes('started')) return 'play-circle';
    return 'bell';
  };

  const getIconColor = () => {
    const titleLower = title?.toLowerCase() || '';
    if (titleLower.includes('payment') || titleLower.includes('earning')) return '#4CAF50';
    if (titleLower.includes('cancelled') || titleLower.includes('cancel')) return '#f44336';
    if (titleLower.includes('completed') || titleLower.includes('accepted')) return '#2196F3';
    if (titleLower.includes('booking') || titleLower.includes('request')) return '#FF9800';
    return MAROON;
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) { // Less than 24 hours
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days}d ago`;
    }
  };

  return (
    <View style={[styles.itemRow, !read && styles.unreadItem]}>
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
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={onPress}>
            <Text style={styles.actionButtonText}>View</Text>
          </TouchableOpacity>
        </View>
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
  actionButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  actionButton: {
    backgroundColor: MAROON,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
