import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NotificationService from '../services/notificationService';
import { useAuth } from '../hooks/useAuth';

const MAROON = '#6B2E2B';

export default function NotificationTester() {
  const [isListening, setIsListening] = useState(false);
  const [lastNotification, setLastNotification] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user && (user.role === 'driver' || user.role === 'driver-owner')) {
      startListening();
    }
    
    return () => {
      NotificationService.stopPolling();
    };
  }, [user]);

  const startListening = async () => {
    if (!user) return;
    
    try {
      setIsListening(true);
      
      // Start notification polling
      NotificationService.startPolling(user.id, (notifications) => {
        console.log('📱 Received notifications:', notifications);
        
        if (notifications.length > 0) {
          const latest = notifications[0];
          setLastNotification(latest);
          
          // Show alert for new notifications
          Alert.alert(
            '🔔 New Notification!',
            `${latest.title}: ${latest.message}`,
            [{ text: 'OK' }]
          );
        }
      });
      
      Alert.alert('✅ Notification Listener Started', 'You will now receive booking notifications');
    } catch (error) {
      console.error('Error starting notification listener:', error);
      Alert.alert('❌ Error', 'Failed to start notification listener');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    NotificationService.stopPolling();
    setIsListening(false);
    setLastNotification(null);
    Alert.alert('🔕 Notification Listener Stopped');
  };

  const testNotification = async () => {
    if (!user) return;
    
    try {
      const result = await NotificationService.testNotification(user.id);
      if (result.success) {
        Alert.alert('✅ Test Sent', 'Test notification sent successfully');
      } else {
        Alert.alert('❌ Test Failed', result.error || 'Failed to send test notification');
      }
    } catch (error) {
      Alert.alert('❌ Error', error.message);
    }
  };

  if (!user || (user.role !== 'driver' && user.role !== 'driver-owner')) {
    return null; // Only show for drivers
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="notifications" size={24} color={MAROON} />
        <Text style={styles.title}>Notification Tester</Text>
      </View>
      
      <View style={styles.status}>
        <View style={[styles.indicator, { backgroundColor: isListening ? '#4CAF50' : '#f44336' }]} />
        <Text style={styles.statusText}>
          {isListening ? 'Listening for notifications' : 'Not listening'}
        </Text>
      </View>

      {lastNotification && (
        <View style={styles.lastNotification}>
          <Text style={styles.lastTitle}>Last Notification:</Text>
          <Text style={styles.notificationTitle}>{lastNotification.title}</Text>
          <Text style={styles.notificationMessage}>{lastNotification.message}</Text>
          <Text style={styles.notificationTime}>
            {new Date(lastNotification.created_at).toLocaleTimeString()}
          </Text>
        </View>
      )}

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={isListening ? stopListening : startListening}
        >
          <Ionicons 
            name={isListening ? "stop" : "play"} 
            size={16} 
            color="white" 
          />
          <Text style={styles.buttonText}>
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={testNotification}
        >
          <Ionicons name="send" size={16} color={MAROON} />
          <Text style={[styles.buttonText, { color: MAROON }]}>
            Send Test
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  lastNotification: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  lastTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
    color: '#999',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  primaryButton: {
    backgroundColor: MAROON,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: MAROON,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
});