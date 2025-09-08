import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../hooks/useAuth';

const NotificationBell = () => {
  const [showModal, setShowModal] = useState(false);
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const { user } = useAuth();

  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.read && styles.unread]}
      onPress={() => markAsRead(item.id)}
    >
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.message}>{item.message}</Text>
      <Text style={styles.time}>
        {new Date(item.created_at).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      <TouchableOpacity
        style={styles.bellContainer}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="notifications" size={24} color="#333" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id.toString()}
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No notifications</Text>
            }
          />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bellContainer: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  notificationItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  unread: {
    backgroundColor: '#f0f8ff',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  time: {
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    padding: 32,
    color: '#999',
  },
});

export default NotificationBell;