import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import RootNavigator from './navigation/RootNavigator';
import AppInitService from './services/AppInitService';
import { installFetchInterceptor, wasSessionExpiredFlagSet, clearSessionExpiredFlag } from './services/fetchInterceptor';
import { on, off, EVENTS } from './services/eventBus';

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(null);
  const navRef = useRef(createNavigationContainerRef());

  useEffect(() => {
    // Install fetch interceptor once
    installFetchInterceptor();

    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('[App] Starting app initialization...');

      // If previous session expired flag is set (e.g., app was backgrounded), show message once
      if (await wasSessionExpiredFlagSet()) {
        try { await clearSessionExpiredFlag(); } catch {}
        // Defer alert slightly to avoid during splash
        setTimeout(() => {
          Alert.alert('Session expired', 'Your session has expired. Please log in again.');
          // Navigation will go to Welcome once RootNavigator loads auth state,
          // but we also try to reset here just in case
          if (navRef.current?.isReady?.()) {
            navRef.current.reset({ index: 0, routes: [{ name: 'Welcome' }] });
          }
        }, 600);
      }

      const result = await AppInitService.initialize();
      
      if (result.errors && result.errors.length > 0) {
        console.warn('[App] Initialization completed with errors:', result.errors);
      } else {
        console.log('[App] App initialized successfully');
      }
      
      // Small delay to show splash screen
      setTimeout(() => {
        setIsInitializing(false);
      }, 500);
    } catch (error) {
      console.error('[App] Failed to initialize app:', error);
      setInitError(error.message);
      // Still allow app to continue even if initialization fails
      setTimeout(() => {
        setIsInitializing(false);
      }, 1000);
    }
  };

  // Subscribe to session expiry event
  useEffect(() => {
    const handler = () => {
      Alert.alert('Session expired', 'Your session has expired. Please log in again.');
      if (navRef.current?.isReady?.()) {
        navRef.current.reset({ index: 0, routes: [{ name: 'Welcome' }] });
      }
    };
    on(EVENTS.SESSION_EXPIRED, handler);
    return () => off(EVENTS.SESSION_EXPIRED, handler);
  }, []);

  if (isInitializing) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.splashText}>Loading Tartanilla...</Text>
        {initError && (
          <Text style={styles.errorText}>Loading in offline mode</Text>
        )}
      </View>
    );
  }

  return (
    <NavigationContainer ref={navRef}>
      <RootNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  splashText: {
    marginTop: 20,
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});
