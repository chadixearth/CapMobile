import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAROON = '#6B2E2B';

export default function ChatBubble({ message }) {
  const isMe = message.sender === 'me';
  const showStatus = isMe && message.status;
  const [translated, setTranslated] = useState('');
  
  // Enhanced status icon display
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
  
  // Format the status text
  const getStatusText = () => {
    switch (message.status) {
      case 'sending': return 'Sending...';
      case 'sent': return 'Sent';
      case 'delivered': return 'Delivered';
      case 'read': return 'Read';
      default: return '';
    }
  };

  // Client-side translation Tagalog (tl) -> English (en) via Google Translate web API
  useEffect(() => {
    let ignore = false;
    async function translate() {
      if (!message.text) return;
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=tl&tl=en&dt=t&q=${encodeURIComponent(message.text)}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('Google Translate API error: ' + res.status);
        }
        const data = await res.json();
        if (!ignore) {
          if (Array.isArray(data) && Array.isArray(data[0]) && Array.isArray(data[0][0]) && data[0][0][0]) {
            setTranslated(data[0][0][0]);
          } else {
            setTranslated('[Translation unavailable]');
            console.error('Google Translate API returned unexpected data:', data);
          }
        }
      } catch (e) {
        if (!ignore) {
          setTranslated('[Translation failed]');
          console.error('Translation error:', e);
        }
      }
    }
    translate();
    return () => { ignore = true; };
  }, [message.text]);

  return (
    <View style={[
      styles.bubble,
      isMe ? styles.meBubble : styles.otherBubble
    ]}>
      <Text style={styles.bubbleText}>{message.text}</Text>
      {translated && translated !== message.text && (
        <Text style={styles.translatedText}>{translated}</Text>
      )}
      <View style={styles.timeRow}>
        {message.time && <Text style={styles.timeText}>{message.time}</Text>}
        {showStatus && (
          <View style={styles.statusContainer}>
            {getStatusIcon()}
            {message.status === 'read' && (
              <Text style={styles.readStatus}>{getStatusText()}</Text>
            )}
          </View>
        )}
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
  },
  readStatus: {
    fontSize: 9,
    color: '#6BAE6A',
    marginLeft: 2,
  },
  translatedText: {
    fontSize: 12,
    color: '#6BAE6A',
    marginTop: 2,
    fontStyle: 'italic',
  }
});