import * as React from 'react';
import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import RootNavigator from './navigation/RootNavigator';
import AppInitService from './services/AppInitService';

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('[App] Starting app initialization...');
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
    <NavigationContainer>
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
