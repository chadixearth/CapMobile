import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#6B2E2B',
  bg: '#F8F9FA',
  text: '#1A1A1A',
  sub: '#6B7280',
};

export default function LoadingScreen({ 
  message = 'Loading...', 
  icon = 'hourglass-outline',
  showIcon = true,
  backgroundColor = COLORS.bg 
}) {
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.content}>
        {showIcon && (
          <View style={styles.iconContainer}>
            <Ionicons name={icon} size={48} color={COLORS.primary} />
          </View>
        )}
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.spinner} />
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 16,
    opacity: 0.8,
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: COLORS.sub,
    textAlign: 'center',
    fontWeight: '500',
  },
});