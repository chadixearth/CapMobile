import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import RootNavigator from './navigation/RootNavigator';
import AppInitService from './services/AppInitService';
import { setSessionExpiredCallback, clearLocalSession } from './services/authService';

import ErrorProvider from './components/ErrorProvider';
import ErrorHandlingService from './services/errorHandlingService';
import { NotificationProvider } from './contexts/NotificationContext';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import NetworkStatus from './components/NetworkStatus';
import mobileDiagnostics from './services/mobileDiagnostics';

// Suppress location-related console errors
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  if (message.includes('Location request failed') || 
      message.includes('unsatisfied device settings') ||
      message.includes('location') && message.includes('failed')) {
    // Silently ignore location errors
    return;
  }
  originalConsoleError.apply(console, args);
};

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(null);
  const navRef = useRef(createNavigationContainerRef());

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('[App] Starting app initialization...');
      
      // Initialize mobile diagnostics
      await mobileDiagnostics.initialize();
      
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
    <GlobalErrorBoundary>
      <ErrorProvider>
        <NotificationProvider>
          <NavigationContainer 
          ref={navRef}
          onReady={() => {
            // Set navigation reference for error handling service
            ErrorHandlingService.setNavigationRef(navRef.current);
            // Make navigation ref globally available for logout
            global.navigationRef = navRef.current;
            
            // Set up JWT expiry callback
            setSessionExpiredCallback(() => {
              console.log('[App] JWT expired, logging out user');
              Alert.alert(
                'Session Expired',
                'Your session has expired. Please log in again.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate to login screen
                      if (navRef.current) {
                        navRef.current.reset({
                          index: 0,
                          routes: [{ name: 'Auth' }],
                        });
                      }
                    }
                  }
                ]
              );
            });
          }}
        >
            <NetworkStatus />
            <RootNavigator />
          </NavigationContainer>
        </NotificationProvider>
      </ErrorProvider>
    </GlobalErrorBoundary>
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
