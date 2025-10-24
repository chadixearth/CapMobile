// src/components/TARTRACKHeader.js
import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../contexts/NotificationContext';

const TARTRACKHeader = ({
  showBack = false,
  onBackPress,
  onNotificationPress,
  onMessagePress,
  containerStyle,
  headerStyle,
  logoSource,
  showMessage = true,
  showNotification = true,
  // default to white so icons contrast with the dark brand bar
  tint = '#FFFFFF',
}) => {
  const defaultLogo = require('../../assets/tartrack_whitel.png');
  const { unreadCount } = useNotifications();

  const handleNotificationPress = () => {
    if (onNotificationPress) {
      onNotificationPress();
    } else if (global.navigationRef) {
      global.navigationRef.navigate('Notification');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, containerStyle]}>
      <View style={[styles.header, headerStyle]}>
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
              <Ionicons name="arrow-back" size={26} color={tint} />
            </TouchableOpacity>
          ) : (
            <Image
              source={logoSource || defaultLogo}
              style={styles.logo}
              resizeMode="contain"
            />
          )}
        </View>

        {/* Right: (optional) Message + Notification */}
        <View style={styles.rightCluster}>
          {showMessage && (
            <TouchableOpacity
              onPress={onMessagePress}
              style={styles.iconBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Open messages"
              activeOpacity={0.7}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={24}
                color={tint}
              />
            </TouchableOpacity>
          )}

          {showNotification && (
            <TouchableOpacity
              onPress={handleNotificationPress}
              style={styles.iconBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
              activeOpacity={0.7}
            >
              <View style={styles.notificationContainer}>
                <Ionicons name="notifications-outline" size={24} color={tint} />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const BRAND = '#6B2E2B';

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: BRAND,   // brand color behind status bar / notch
  },
  header: {
    height: 56,
    backgroundColor: BRAND,   // brand color for the header bar
    borderBottomWidth: 0,     // remove light border (optional)
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
    zIndex: 1000,
  },
  iconBtn: {
    marginLeft: 12,
    padding: 4,
    zIndex: 1000,
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
