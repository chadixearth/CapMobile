// screens/main/NotificationScreen.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, AppState, Modal, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { useRefresh } from '../../hooks/useRefresh';
import { useScreenAutoRefresh } from '../../services/dataInvalidationService';
import NotificationService from '../../services/notificationService';
import * as Routes from '../../constants/routes';

const MAROON = '#6B2E2B';
const MAROON_LIGHT = '#F5E9E2';
const TEXT = '#222';
const MUTED = '#777';

export default function NotificationScreen({ navigation }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedNotification, setSelectedNotification] = useState(null);
  const { notifications, unreadCount, loadNotifications, markAsRead, markAllAsRead } = useNotifications();
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);
  
  const { refreshing, onRefresh } = useRefresh([
    loadNotifications
  ], {
    showGlobalLoading: false,
    loadingMessage: 'Refreshing notifications...'
  });

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'tours', label: 'Tours' },
    { id: 'rides', label: 'Rides' },
    { id: 'general', label: 'General' }
  ];

  const categorizeNotification = (notification) => {
    const title = notification.title?.toLowerCase() || '';
    const message = notification.message?.toLowerCase() || '';
    
    if (title.includes('tour') || title.includes('package') || message.includes('tour') || message.includes('package')) {
      return 'tours';
    }
    if (title.includes('ride') || title.includes('driver') || title.includes('carriage') || message.includes('ride') || message.includes('driver')) {
      return 'rides';
    }
    return 'general';
  };

  const filteredNotifications = useMemo(() => {
    return selectedCategory === 'all' 
      ? notifications 
      : notifications.filter(n => categorizeNotification(n) === selectedCategory);
  }, [notifications, selectedCategory]);
  
  // Auto-refresh when notification data changes
  useScreenAutoRefresh('NOTIFICATIONS', () => {
    console.log('[NotificationScreen] Auto-refreshing due to data changes');
    loadNotifications();
  });

  useEffect(() => {
    // Initialize notification service
    NotificationService.initialize();
    loadNotifications();

    // Handle app state changes - immediate refresh when app becomes active
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground, refresh notifications immediately
        console.log('[NotificationScreen] App active - refreshing notifications');
        loadNotifications();
        // Also trigger a fresh poll
        NotificationService.stopPolling();
        NotificationService.startPolling(user?.id, () => loadNotifications());
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // onRefresh is now handled by useRefresh hook

  const handleNotificationPress = (notification) => {
    markAsRead(notification.id);
    NotificationService.markAsRead(notification.id);
    
    const title = notification.title?.toLowerCase() || '';
    const message = notification.message?.toLowerCase() || '';
    const userRole = user?.role;
    
    // Navigate based on notification type
    const navigateForNotification = () => {
      if (title.includes('booking') || title.includes('request') || message.includes('booking')) {
        return userRole === 'tourist' ? Routes.BOOK : Routes.BOOKINGS;
      }
      if (title.includes('payment') || title.includes('earning') || message.includes('payment')) {
        return userRole === 'tourist' ? Routes.BOOK : Routes.BREAKEVEN;
      }
      if (title.includes('ride') || message.includes('ride')) {
        return userRole === 'tourist' ? Routes.BOOK : Routes.BOOKINGS;
      }
      return null;
    };

    const route = navigateForNotification();
    if (route) {
      try {
        navigation.navigate(route);
      } catch (error) {
        console.log('Navigation failed:', error.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with back button and title */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {/* Categories */}
      <View style={styles.categoriesContainer}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryBtn,
              selectedCategory === category.id && styles.categoryBtnActive
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Text style={[
              styles.categoryText,
              selectedCategory === category.id && styles.categoryTextActive
            ]}>
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Action buttons */}
      {unreadCount > 0 && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.markAllBtn} onPress={async () => {
            console.log('[NotificationScreen] Mark all as read pressed');
            await markAllAsRead();
          }}>
            <Ionicons name="checkmark-done" size={16} color={MAROON} />
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <NotificationItem 
            {...item} 
            category={categorizeNotification(item)}
            onPress={() => handleNotificationPress(item)}

          />
        )}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off" size={48} color={MUTED} />
            <Text style={styles.emptyText}>
              {selectedCategory === 'all' ? 'No notifications yet' : `No ${selectedCategory} notifications`}
            </Text>
          </View>
        }
      />
      

    </View>
  );
}

function NotificationItem({ title, message, created_at, read, type, category, onPress }) {
  const getIcon = () => {
    const titleLower = title?.toLowerCase() || '';
    
    // Category-based icons
    if (category === 'tours') {
      if (titleLower.includes('booking') || titleLower.includes('request')) return 'calendar';
      if (titleLower.includes('completed')) return 'checkmark-circle';
      if (titleLower.includes('cancelled')) return 'close-circle';
      return 'map';
    }
    
    if (category === 'rides') {
      if (titleLower.includes('driver')) return 'account';
      if (titleLower.includes('completed')) return 'check-circle';
      if (titleLower.includes('started')) return 'play-circle';
      return 'car';
    }
    
    // General notifications
    if (titleLower.includes('payment') || titleLower.includes('earning')) return 'credit-card';
    if (titleLower.includes('account') || titleLower.includes('profile')) return 'account-circle';
    return 'information';
  };

  const getIconColor = () => {
    const titleLower = title?.toLowerCase() || '';
    
    // Status-based colors
    if (titleLower.includes('payment') || titleLower.includes('earning')) return '#4CAF50';
    if (titleLower.includes('cancelled') || titleLower.includes('cancel')) return '#f44336';
    if (titleLower.includes('completed') || titleLower.includes('accepted')) return '#2196F3';
    
    // Category-based colors
    if (category === 'tours') return '#FF9800';
    if (category === 'rides') return '#9C27B0';
    
    return MAROON;
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) {
      return 'Yesterday';
    }
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  container: { flex: 1, backgroundColor: '#FAFAFA' },

  // Header with integrated back button
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 44,
    paddingHorizontal: 18,
    paddingBottom: 16,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    backgroundColor: MAROON,
    borderRadius: 20,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT,
    flex: 1,
  },
  headerBadge: {
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },

  /* Categories */
  categoriesContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  categoryBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  categoryBtnActive: {
    backgroundColor: MAROON,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  categoryTextActive: {
    color: '#fff',
  },

  /* Action Bar */
  actionBar: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  markAllText: { 
    color: MAROON, 
    fontWeight: '600', 
    fontSize: 13 
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  testText: { 
    color: MAROON, 
    fontWeight: '600', 
    fontSize: 13 
  },

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
    gap: 12,
  },
  emptyText: {
    color: MUTED,
    fontSize: 16,
    textAlign: 'center',
  },

});
