// src/components/TARTRACKHeader.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import NotificationService from '../services/notificationService';
import { useAuth } from '../hooks/useAuth';

const TARTRACKHeader = ({
  showBack = false,
  onBackPress,
  onNotificationPress,
  onMessagePress,
  containerStyle,
  logoSource,
}) => {
  const defaultLogo = require('../../assets/TarTrack Logo_sakto.png');
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // Load unread count with filtering
    const loadUnreadCount = async () => {
      const result = await NotificationService.getNotifications(user.id);
      if (result.success) {
        // Filter out test notifications
        const filteredData = (result.data || []).filter(n => 
          !n.title.includes('Test Notification') && 
          !n.message.includes('test notification to verify') &&
          !n.title.includes('Test Booking Request') &&
          !n.message.includes('Test Tourist') &&
          !n.message.includes('Test Driver')
        );
        setUnreadCount(filteredData.filter(n => !n.read).length);
      }
    };
    loadUnreadCount();

    // Subscribe to new notifications and update count
    const subscription = NotificationService.subscribeToNotifications(
      user.id,
      (notifications) => {
        // Filter out test notifications
        const filteredNotifications = notifications.filter(n => 
          !n.title.includes('Test Notification') && 
          !n.message.includes('test notification to verify') &&
          !n.title.includes('Test Booking Request') &&
          !n.message.includes('Test Tourist') &&
          !n.message.includes('Test Driver')
        );
        
        // Reload count to get accurate unread count
        loadUnreadCount();
      }
    );

    return () => subscription.unsubscribe();
  }, [user?.id]);

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, containerStyle]}>
      <View style={styles.header}>
        {/* Left: Back button OR logo */}
        <View style={styles.leftCluster}>
          {showBack ? (
            <TouchableOpacity
              style={styles.leftBtn}
              onPress={onBackPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={26} color="#6B2E2B" />
            </TouchableOpacity>
          ) : (
            <Image
              source={logoSource || defaultLogo}
              style={styles.logo}
              resizeMode="contain"
            />
          )}
        </View>

        {/* Right: Message + Notification */}
        <View style={styles.rightCluster}>
          <TouchableOpacity
            onPress={onMessagePress}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Open messages"
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={24}
              color="#6B2E2B"
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onNotificationPress}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
          >
            <View style={styles.notificationContainer}>
              <Ionicons name="notifications-outline" size={24} color="#6B2E2B" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
  },
  header: {
    height: 56,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },

  /* Left */
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftBtn: {
    padding: 4,
  },
  logo: {
    width: 160,
    height: 37,
  },

  /* Right */
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    marginLeft: 12,
    padding: 4,
  },
  notificationContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default TARTRACKHeader;
