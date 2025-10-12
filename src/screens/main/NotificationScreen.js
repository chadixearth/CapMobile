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
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { notifications, unreadCount, loadNotifications, markAsRead, markAllAsRead } = useNotifications();
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);

  const categories = [
    { id: 'all', label: 'All', icon: 'bell' },
    { id: 'tours', label: 'Tours', icon: 'map' },
    { id: 'rides', label: 'Rides', icon: 'car' },
    { id: 'general', label: 'General', icon: 'information' }
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

  const filteredNotifications = selectedCategory === 'all' 
    ? notifications 
    : notifications.filter(n => categorizeNotification(n) === selectedCategory);
  
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

      {/* Header */}
      <View style={styles.headerBar}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {/* Categories */}
      <View style={styles.categoriesContainer}>
        {categories.map((category) => {
          const categoryCount = category.id === 'all' 
            ? notifications.length 
            : notifications.filter(n => categorizeNotification(n) === category.id).length;
          
          return (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryBtn,
                selectedCategory === category.id && styles.categoryBtnActive
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Ionicons 
                name={category.icon} 
                size={16} 
                color={selectedCategory === category.id ? '#fff' : MAROON} 
              />
              <Text style={[
                styles.categoryText,
                selectedCategory === category.id && styles.categoryTextActive
              ]}>
                {category.label}
              </Text>
              {categoryCount > 0 && (
                <View style={[
                  styles.categoryBadge,
                  selectedCategory === category.id && styles.categoryBadgeActive
                ]}>
                  <Text style={[
                    styles.categoryBadgeText,
                    selectedCategory === category.id && styles.categoryBadgeTextActive
                  ]}>
                    {categoryCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Mark all as read button */}
      {unreadCount > 0 && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllAsRead}>
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
      if (titleLower.includes('driver')) return 'person';
      if (titleLower.includes('completed')) return 'checkmark-circle';
      if (titleLower.includes('started')) return 'play-circle';
      return 'car';
    }
    
    // General notifications
    if (titleLower.includes('payment') || titleLower.includes('earning')) return 'card';
    if (titleLower.includes('account') || titleLower.includes('profile')) return 'person-circle';
    return 'information-circle';
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: 0.3,
  },
  badge: {
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },

  /* Categories */
  categoriesContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 12,
    gap: 8,
  },
  categoryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: MAROON,
    backgroundColor: '#fff',
    gap: 4,
  },
  categoryBtnActive: {
    backgroundColor: MAROON,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: MAROON,
  },
  categoryTextActive: {
    color: '#fff',
  },
  categoryBadge: {
    backgroundColor: MAROON,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadgeActive: {
    backgroundColor: '#fff',
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  categoryBadgeTextActive: {
    color: MAROON,
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
