// screens/chat/ChatScreen.jsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAROON = '#6B2E2B';

export default function ChatScreen({ route, navigation }) {
  const name = route?.params?.name || 'Conversation';

  const [messages, setMessages] = useState([
    { id: '1', text: 'Good day!', sender: 'other', time: '8:21 AM' },
    { id: '2', text: 'I just want to inquire about the event booking you have. Is it still available for booking?', sender: 'other' },
    { id: '3', text: 'Good day ma’am/sir, the said post is still available for booking.\n\nIf you want to book just fill in the details.', sender: 'me' },
    { id: '4', text: 'Okay Thanks.', sender: 'other' },
  ]);
  const [input, setInput] = useState('');

  const sendMessage = () => {
    const v = input.trim();
    if (!v) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), text: v, sender: 'me' }]);
    setInput('');
  };

  const renderItem = ({ item }) => (
    <View style={[
      styles.bubble,
      item.sender === 'me' ? styles.meBubble : styles.otherBubble
    ]}>
      <Text style={styles.bubbleText}>{item.text}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#222" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
          <Text style={styles.headerSub}>Always active</Text>
        </View>

        <TouchableOpacity style={styles.menuBtn}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#444" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
      />

      {/* Input */}
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.fab} onPress={sendMessage}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12, paddingTop: 25, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#eee',
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F3F3' },
  headerName: { fontSize: 14, fontWeight: '800', color: '#222' },
  headerSub: { fontSize: 11, color: '#6BAE6A' },
  menuBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F3F3' },

  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 16, marginBottom: 10,
  },
  meBubble: { backgroundColor: 'rgba(107,46,43,0.18)', alignSelf: 'flex-end', borderTopRightRadius: 6 },
  otherBubble: { backgroundColor: '#FFFDEB', alignSelf: 'flex-start', borderTopLeftRadius: 6 },
  bubbleText: { color: '#333', fontSize: 14 },

  inputWrap: {
    padding: 12, paddingRight: 66, // space for FAB
    borderTopWidth: 1, borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  input: {
    height: 44, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 22, paddingHorizontal: 14, color: '#222',
    backgroundColor: '#fff',
  },
  fab: {
    position: 'absolute', right: 16, bottom: 16,
    width: 44, height: 44, borderRadius: 22, backgroundColor: MAROON,
    alignItems: 'center', justifyContent: 'center', elevation: 3,
  },
});
