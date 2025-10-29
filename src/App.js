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
import CustomModalProvider from './components/CustomModalProvider';
import CustomModalService from './services/CustomModalService';

// Suppress location-related console errors and UIFrameGuarded warnings
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  const message = args.join(' ');
  if (message.includes('Location request failed') || 
      message.includes('unsatisfied device settings') ||
      message.includes('UIFrameGuarded') ||
      message.includes('RCTImageView') ||
      message.includes('location') && message.includes('failed')) {
    // Silently ignore location, UIFrameGuarded, and image errors
    return;
  }
  originalConsoleError.apply(console, args);
};

console.warn = (...args) => {
  const message = args.join(' ');
  if (message.includes('UIFrameGuarded') || 
      message.includes('Navigation reset failed')) {
    // Silently ignore UIFrameGuarded warnings
    return;
  }
  originalConsoleWarn.apply(console, args);
};

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(null);
  const navRef = useRef(createNavigationContainerRef());
  const modalRef = useRef(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize mobile diagnostics
      await mobileDiagnostics.initialize();
      
      const result = await AppInitService.initialize();
      
      // Small delay to show splash screen
      setTimeout(() => {
        setIsInitializing(false);
      }, 500);
    } catch (error) {
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
            try {
              // Set navigation reference for error handling service
              if (navRef.current) {
                ErrorHandlingService.setNavigationRef(navRef.current);
                // Make navigation ref globally available for logout
                global.navigationRef = navRef.current;
              }
              
              // Set up JWT expiry callback with safety checks
              const handleSessionExpiry = () => {
                try {
                  if (navRef.current && navRef.current.isReady()) {
                    navRef.current.reset({
                      index: 0,
                      routes: [{ name: 'Login' }],
                    });
                  }
                } catch (error) {
                  console.warn('Navigation reset failed:', error);
                }
              };
              
              setSessionExpiredCallback(handleSessionExpiry);
              
              // Also set up API client session expiry callback
              const { apiClient } = require('./services/improvedApiClient');
              apiClient.setSessionExpiredCallback(handleSessionExpiry);
              
              // Set up custom modal service
              if (modalRef.current) {
                CustomModalService.setModalRef(modalRef.current);
              }
            } catch (error) {
              console.warn('Navigation setup error:', error);
            }
          }}
        >
            <NetworkStatus />
            <RootNavigator />
            <CustomModalProvider ref={modalRef} />
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
