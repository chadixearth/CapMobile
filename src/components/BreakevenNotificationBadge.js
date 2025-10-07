// components/BreakevenNotificationBadge.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BreakevenNotificationManager from '../services/breakeven';
import { colors, spacing } from '../styles/global';

const BreakevenNotificationBadge = ({ driverId, style }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (driverId) {
      loadNotifications();
    }
  }, [driverId]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const recentNotifications = await BreakevenNotificationManager.getRecentBreakevenNotifications(driverId);
      setNotifications(recentNotifications);
      
      // Count unread notifications
      const unread = recentNotifications.filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading breakeven notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (title) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('breakeven')) return 'target-outline';
    if (titleLower.includes('profit') && titleLower.includes('milestone')) return 'trophy-outline';
    if (titleLower.includes('profitable')) return 'trending-up-outline';
    if (titleLower.includes('update')) return 'information-circle-outline';
    return 'notifications-outline';
  };

  const getNotificationColor = (title) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('breakeven')) return '#2E7D32';
    if (titleLower.includes('milestone')) return '#F57C00';
    if (titleLower.includes('profitable')) return '#1976D2';
    if (titleLower.includes('update')) return '#5E35B1';
    return colors.primary;
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const notificationDate = new Date(dateString);
    const diffMs = now - notificationDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notificationDate.toLocaleDateString();
  };

  if (!driverId || notifications.length === 0) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.badge, style]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons 
          name="calculator-variant" 
          size={16} 
          color={colors.primary} 
        />
        <Text style={styles.badgeText}>Breakeven</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={styles.modalBackdrop} 
          onPress={() => setModalVisible(false)} 
        />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Breakeven Notifications</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading notifications...</Text>
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons 
                  name="calculator-variant-outline" 
                  size={48} 
                  color={colors.textSecondary} 
                />
                <Text style={styles.emptyText}>No breakeven notifications yet</Text>
                <Text style={styles.emptySubtext}>
                  You'll receive notifications when you reach breakeven, profit milestones, and other achievements.
                </Text>
              </View>
            ) : (
              notifications.map((notification, index) => (
                <View
                  key={notification.id || index}
                  style={[
                    styles.notificationItem,
                    !notification.read && styles.unreadNotification,
                    index < notifications.length - 1 && styles.notificationBorder
                  ]}
                >
                  <View style={styles.notificationIcon}>
                    <Ionicons
                      name={getNotificationIcon(notification.title)}
                      size={20}
                      color={getNotificationColor(notification.title)}
                    />
                  </View>
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle}>
                      {notification.title}
                    </Text>
                    <Text style={styles.notificationMessage} numberOfLines={3}>
                      {notification.message}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {formatTimeAgo(notification.created_at)}
                    </Text>
                  </View>
                  {!notification.read && (
                    <View style={styles.unreadDot} />
                  )}
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadNotifications}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4ECE8',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E8D5CE',
    position: 'relative',
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalCard: {
    marginHorizontal: 20,
    marginTop: 80,
    marginBottom: 40,
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  notificationsList: {
    maxHeight: 400,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  unreadNotification: {
    backgroundColor: '#F8F9FA',
  },
  notificationBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4ECE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
    marginTop: 6,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  refreshText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
});

export default BreakevenNotificationBadge;