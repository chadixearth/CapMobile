import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, StatusBar } from 'react-native';
import { checkAuthStatus } from '../../services/authService';

// Reuse the same logo you use elsewhere
const LOGO = require('../../../assets/TarTrack Logo_sakto.png');

export default function SplashScreen({ navigation, setRole }) {
  useEffect(() => {
    (async () => {
      try {
        const authStatus = await checkAuthStatus();

        if (authStatus?.isLoggedIn && authStatus?.user) {
          const userRole = authStatus.user.role || 'tourist';
          setRole?.(userRole);
          navigation.replace('Main');
        } else {
          setTimeout(() => navigation.replace('Welcome'), 1000);
        }
      } catch (e) {
        console.error('Authentication check failed:', e);
        setTimeout(() => navigation.replace('Welcome'), 1000);
      }
    })();
  }, [navigation, setRole]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.centerBlock}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.tagline}>
          Cebu Tartanilla Online{'\n'}Booking
        </Text>
      </View>

      {/* Optional tiny spinner near the bottom */}
      <ActivityIndicator size="small" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    width: 260,      // tweak to match your asset proportions
    height: 80,      // keep enough height so the wheels are visible
    marginBottom: 0,
  },
  tagline: {
    textAlign: 'center',
    color: '#1A1A1A',
    fontSize: 14,
    letterSpacing: 4,
    fontStyle: 'italic',
  },
  spinner: {
    position: 'absolute',
    bottom: 36,
  },
});
