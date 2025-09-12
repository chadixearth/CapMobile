import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { requestAccountDeletion, cancelAccountDeletion } from '../services/accountDeletionService';
import { logoutUser } from '../services/authService';

/**
 * Account Deletion Handler Component
 * Handles the 7-day deletion flow with automatic logout and login cancellation
 */
export const AccountDeletionHandler = {
  
  /**
   * Request account deletion with automatic logout
   */
  async requestDeletion(userId, reason = null, onLogout = null) {
    try {
      Alert.alert(
        'Delete Account',
        'Are you sure you want to delete your account? This action will:\n\n• Schedule your account for deletion in 7 days\n• Log you out immediately\n• Suspend your account until deletion\n\nYou can cancel by logging in again within 7 days.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Account',
            style: 'destructive',
            onPress: async () => {
              try {
                const result = await requestAccountDeletion(userId, reason);
                
                if (result.success) {
                  // Show success message
                  Alert.alert(
                    'Account Deletion Scheduled',
                    result.message || 'Your account has been scheduled for deletion in 7 days. You have been logged out and your account is suspended. You can cancel this by logging in again within 7 days.',
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          // Call logout callback to navigate to login screen
                          if (onLogout) {
                            onLogout();
                          }
                        }
                      }
                    ]
                  );
                } else {
                  Alert.alert('Error', result.error || 'Failed to request account deletion');
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to request account deletion: ' + error.message);
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to process deletion request: ' + error.message);
    }
  },

  /**
   * Handle login result and show deletion cancellation message if applicable
   */
  handleLoginResult(loginResult, onSuccess = null) {
    if (loginResult.success) {
      if (loginResult.deletion_cancelled) {
        // Show cancellation success message
        Alert.alert(
          'Welcome Back! 🎉',
          loginResult.message || 'Your scheduled account deletion has been automatically cancelled. Your account is now fully active and safe.',
          [
            {
              text: 'Continue',
              onPress: () => {
                if (onSuccess) {
                  onSuccess(loginResult);
                }
              }
            }
          ]
        );
      } else {
        // Normal login success
        if (onSuccess) {
          onSuccess(loginResult);
        }
      }
    } else if (loginResult.scheduled_for_deletion) {
      // Account is scheduled for deletion but login failed for some reason
      Alert.alert(
        'Account Scheduled for Deletion',
        `Your account is scheduled for deletion. ${loginResult.days_remaining || 0} days remaining. Please contact support if you need assistance.`,
        [{ text: 'OK' }]
      );
    }
  },

  /**
   * Manually cancel account deletion (if user has access)
   */
  async cancelDeletion(userId, onSuccess = null) {
    try {
      Alert.alert(
        'Cancel Account Deletion',
        'Are you sure you want to cancel your scheduled account deletion? Your account will be reactivated immediately.',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel Deletion',
            onPress: async () => {
              try {
                const result = await cancelAccountDeletion(userId);
                
                if (result.success) {
                  Alert.alert(
                    'Deletion Cancelled! ✅',
                    result.message || 'Your account deletion has been cancelled successfully. Your account is now active and safe.',
                    [
                      {
                        text: 'Great!',
                        onPress: () => {
                          if (onSuccess) {
                            onSuccess(result);
                          }
                        }
                      }
                    ]
                  );
                } else {
                  Alert.alert('Error', result.error || 'Failed to cancel account deletion');
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to cancel deletion: ' + error.message);
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to process cancellation: ' + error.message);
    }
  }
};

export default AccountDeletionHandler;