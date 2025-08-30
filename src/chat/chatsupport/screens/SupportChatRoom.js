import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ChatBubble from '../components/ChatBubble';
import { getConversationMessages, sendMessage, markMessagesAsRead } from '../../services/chatService';
import { getCurrentUser } from '../../utils/userUtils';

const MAROON = '#6B2E2B';

function BackBtn({ onPress }) {
  return (
    <TouchableOpacity style={styles.backBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="arrow-back" size={22} color={MAROON} />
    </TouchableOpacity>
  );
}

export default function SupportChatRoom({ route, navigation }) {
  const { conversationId, subject, status = 'open' } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState(null);
  const flatListRef = useRef(null);
  
  const isResolved = status !== 'open';
  
  // Load messages
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        
        if (conversationId) {
          const messageData = await getConversationMessages(conversationId);
          setMessages(messageData);
          
          // Mark messages as read
          if (currentUser) {
            await markMessagesAsRead(conversationId, currentUser.id);
          }
        }
      } catch (err) {
        console.error('Error loading messages:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [conversationId]);
  
  // Format message data for ChatBubble component
  const formatMessages = () => {
    if (!user || !messages.length) return [];
    
    return messages.map(msg => ({
      id: msg.id.toString(),
      text: msg.message_text,
      sender: msg.sender_id === user.id ? 'me' : 'other',
      time: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      status: msg.is_read ? 'read' : 'sent',
    }));
  };
  
  // Send a message
  const handleSendMessage = async () => {
    const text = input.trim();
    if (!text || !conversationId) return;
    
    try {
      setSending(true);
      setInput('');
      
      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      const tempMsg = {
        id: tempId,
        text: text,
        sender: 'me',
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        status: 'sending'
      };
      
      setMessages(prev => [...prev, {
        id: tempId,
        message_text: text,
        sender_id: user?.id,
        created_at: new Date().toISOString(),
        is_read: false
      }]);
      
      // Send to server
      const result = await sendMessage(conversationId, text);
      
      // Update with server response if successful
      if (result) {
        setMessages(prev => 
          prev.map(m => m.id === tempId ? result : m)
        );
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [messages]);

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#fff' }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {/* Header */}
      <View style={styles.header}>
        <BackBtn onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>{subject}</Text>
          <Text style={[
            styles.headerStatus, 
            { color: isResolved ? '#6BAE6A' : '#E9AB17' }
          ]}>
            {isResolved ? 'Resolved' : 'Active'}
          </Text>
        </View>
      </View>

      {isResolved && (
        <View style={styles.resolvedBanner}>
          <Text style={styles.resolvedText}>
            ✓ This issue has been resolved
          </Text>
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={MAROON} size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={formatMessages()}
          keyExtractor={(i) => i.id}
          renderItem={({item}) => <ChatBubble message={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
          }
        />
      )}

      {/* Input - only show if not resolved */}
      {!isResolved && (
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            editable={!sending}
          />
          <TouchableOpacity 
            style={[styles.fab, (!input.trim() || sending) && styles.fabDisabled]} 
            onPress={handleSendMessage} 
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff', // Changed from MAROON to white
  },
  backBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12,
    backgroundColor: '#f2f2f2', // Light background for the button
  },
  headerName: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#222', // Changed from white to dark text
  },
  headerStatus: { 
    fontSize: 12,
  },
  
  resolvedBanner: {
    backgroundColor: '#F8F8F8',
    padding: 12,
    alignItems: 'center',
  },
  resolvedText: {
    color: '#888',
    fontWeight: '500',
  },

  inputWrap: {
    padding: 12,
    paddingRight: 66, // space for FAB
    borderTopWidth: 1, 
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  input: {
    height: 44, 
    borderWidth: 1, 
    borderColor: '#E5E5E5', 
    borderRadius: 22, 
    paddingHorizontal: 14, 
    color: '#222',
    backgroundColor: '#fff',
  },
  fab: {
    position: 'absolute', 
    right: 16, 
    bottom: 16,
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: MAROON,
    alignItems: 'center', 
    justifyContent: 'center', 
    elevation: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 20,
  },
  fabDisabled: {
    backgroundColor: '#ccc',
  },
});