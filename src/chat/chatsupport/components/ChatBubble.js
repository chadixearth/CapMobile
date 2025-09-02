import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAROON = '#6B2E2B';

export default function ChatBubble({ message }) {
  const isMe = message.sender === 'me';
  const showStatus = isMe && message.status;
  
  const getStatusIcon = () => {
    switch (message.status) {
      case 'sent': return <Ionicons name="checkmark" size={12} color="#888" />;
      case 'delivered': return <Ionicons name="checkmark-done" size={12} color="#888" />;
      case 'read': return <Ionicons name="checkmark-done" size={12} color="#6BAE6A" />;
      default: return null;
    }
  };

  return (
    <View style={[
      styles.bubble,
      isMe ? styles.meBubble : styles.otherBubble
    ]}>
      <Text style={styles.bubbleText}>{message.text}</Text>
      <View style={styles.timeRow}>
        {message.time && <Text style={styles.timeText}>{message.time}</Text>}
        {showStatus && getStatusIcon()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16, 
    marginBottom: 10,
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
  bubbleText: { color: '#333', fontSize: 14 },
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
});