/**
 * Debug utility for notification service issues
 */

import { testConnection, testNotificationEndpoint, getBackendHealth } from '../services/networkConfig';
import NotificationService from '../services/notificationService';

export async function debugNotificationService() {
  console.log('=== Notification Service Debug ===');
  
  // Test basic connection
  console.log('\n1. Testing basic connection...');
  const connectionTest = await testConnection();
  console.log('Connection test:', connectionTest);
  
  // Test backend health
  console.log('\n2. Testing backend health...');
  const healthTest = await getBackendHealth();
  console.log('Health test:', healthTest);
  
  // Test notification endpoint specifically
  console.log('\n3. Testing notification endpoint...');
  const notificationTest = await testNotificationEndpoint();
  console.log('Notification endpoint test:', notificationTest);
  
  // Check notification service health
  console.log('\n4. Checking notification service health...');
  const serviceHealth = await NotificationService.checkHealth();
  console.log('Service health:', serviceHealth);
  
  // Test getting notifications (if endpoint is available)
  if (notificationTest.success) {
    console.log('\n5. Testing notification fetch...');
    try {
      const testUserId = 'test-user-id';
      const result = await NotificationService.getNotifications(testUserId);
      console.log('Notification fetch result:', {
        success: result.success,
        dataLength: result.data?.length || 0,
        error: result.error
      });
    } catch (error) {
      console.log('Notification fetch error:', error.message);
    }
  } else {
    console.log('\n5. Skipping notification fetch - endpoint not available');
  }
  
  console.log('\n=== Debug Complete ===');
  
  return {
    connection: connectionTest,
    health: healthTest,
    endpoint: notificationTest,
    service: serviceHealth
  };
}

export async function resetNotificationService() {
  console.log('Resetting notification service...');
  NotificationService.stopPolling();
  NotificationService.resetCircuitBreaker();
  console.log('Notification service reset complete');
}

export function getNotificationServiceStatus() {
  return {
    polling_active: !!NotificationService.pollingInterval,
    circuit_open: NotificationService.isCircuitOpen,
    consecutive_failures: NotificationService.consecutiveFailures,
    callbacks_count: NotificationService.callbacks.size
  };
}