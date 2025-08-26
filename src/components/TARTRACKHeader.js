// src/components/TARTRACKHeader.js
import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const TARTRACKHeader = ({
  showBack = false,
  onBackPress,
  onNotificationPress,
  onMessagePress,
  containerStyle,
  logoSource,
}) => {
  const defaultLogo = require('../../assets/TarTrack Logo_sakto.png');

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
            <Ionicons name="notifications-outline" size={24} color="#6B2E2B" />
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
});

export default TARTRACKHeader;
