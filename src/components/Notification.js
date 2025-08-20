import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const typeStyles = {
  success: { backgroundColor: '#d4edda', color: '#155724', icon: 'checkmark-circle-outline' },
  error: { backgroundColor: '#f8d7da', color: '#721c24', icon: 'close-circle-outline' },
  info: { backgroundColor: '#d1ecf1', color: '#0c5460', icon: 'information-circle-outline' },
  warning: { backgroundColor: '#fff3cd', color: '#856404', icon: 'warning-outline' },
};

export default function Notification({ type = 'info', message, onClose }) {
  const { backgroundColor, color, icon } = typeStyles[type] || typeStyles.info;
  return (
    <View style={[styles.container, { backgroundColor }]}> 
      <Ionicons name={icon} size={22} color={color} style={{ marginRight: 8 }} />
      <Text style={[styles.message, { color }]}>{message}</Text>
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={color} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 40,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  message: {
    flex: 1,
    fontSize: 15,
  },
  closeBtn: {
    marginLeft: 8,
    padding: 4,
  },
}); 