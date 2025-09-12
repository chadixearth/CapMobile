import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ChatBubble({ message }) {
  const isMe = message.sender === 'me';
  const showStatus = isMe && message.status;
  
  // Status icon display
  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending': 
        return <Ionicons name="time" size={12} color="#888" />;
      case 'sent': 
        return <Ionicons name="checkmark" size={12} color="#888" />;
      case 'delivered': 
        return <Ionicons name="checkmark-done" size={12} color="#888" />;
      case 'read': 
        return <Ionicons name="checkmark-done" size={12} color="#6BAE6A" />;
      default: 
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Show sender name for other people's messages */}
      {!isMe && message.senderName && (
        <Text style={styles.senderName}>{message.senderName}</Text>
      )}
      
      <View style={[
        styles.bubble,
        isMe ? styles.meBubble : styles.otherBubble
      ]}>
        <Text style={styles.bubbleText}>{message.text}</Text>
        <View style={styles.timeRow}>
          {message.time && <Text style={styles.timeText}>{message.time}</Text>}
          {showStatus && (
            <View style={styles.statusContainer}>
              {getStatusIcon()}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 6,
  },
  senderName: {
    fontSize: 10,
    color: '#666',
    marginLeft: 12,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16, 
    marginBottom: 2,
  },
  meBubble: { 
    backgroundColor: 'rgba(107,46,43,0.18)', 
    alignSelf: 'flex-end', 
    borderTopRightRadius: 6 
  },
  otherBubble: { 
    backgroundColor: '#FFFDEB', 
    alignSelf: 'flex-start', 
    borderTopLeftRadius: 6 
  },
  bubbleText: { 
    color: '#333', 
    fontSize: 14 
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  timeText: { 
    fontSize: 10, 
    color: '#888', 
    marginRight: 4
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
  }
});