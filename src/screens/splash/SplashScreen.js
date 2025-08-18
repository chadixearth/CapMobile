import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { checkAuthStatus } from '../../services/authService';

export default function SplashScreen({ navigation, setRole }) {
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        // Check if user is already logged in
        const authStatus = await checkAuthStatus();
        
        if (authStatus.isLoggedIn && authStatus.user) {
          // User is logged in, get their role and navigate to main screen
          const userRole = authStatus.user.role || 'tourist';
          if (setRole) {
            setRole(userRole);
          }
          navigation.replace('Main');
        } else {
          // User is not logged in, show welcome screen
          setTimeout(() => {
            navigation.replace('Welcome');
          }, 1000);
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        // On error, default to welcome screen
        setTimeout(() => {
          navigation.replace('Welcome');
        }, 1000);
      }
    };

    checkAuthentication();
  }, [navigation, setRole]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to MobileApp!</Text>
      <ActivityIndicator size="large" style={{ marginTop: 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2a2a2a',
  },
}); 