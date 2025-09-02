import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChatBubble from '../components/ChatBubble';
import { 
  getConversationMessages, 
  sendMessage, 
  markMessagesAsRead,
  subscribeToConversationMessages,
  subscribeToMessageUpdates,
  unsubscribe,
  hasOlderMessages
} from '../../services';
import { getCurrentUser } from '../../utils/userUtils';
import { formatMessageTime, getSmartDate } from '../../utils/dateTimeUtils';

const MAROON = '#6B2E2B';
const MESSAGES_PER_PAGE = 15; // Number of messages to load at once

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
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  
  const flatListRef = useRef(null);
  const messageSubscriptionRef = useRef(null);
  const updateSubscriptionRef = useRef(null);
  const sentMessagesRef = useRef(new Set());
  
  const isResolved = status !== 'open';

  // Monitor keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  
  // Initial load of messages and setup subscriptions
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        
        if (conversationId) {
          // Load initial messages (limited count)
          const messageData = await getConversationMessages(conversationId, MESSAGES_PER_PAGE);
          
          // Track loaded message IDs to prevent duplicates
          messageData.forEach(msg => {
            sentMessagesRef.current.add(String(msg.id));
          });
          
          setMessages(messageData);
          
          // Check if there are older messages
          if (messageData.length > 0) {
            const oldestMsgId = messageData[0].id;
            const moreAvailable = await hasOlderMessages(conversationId, oldestMsgId);
            setHasMore(moreAvailable);
          }
          
          // Mark messages as read
          if (currentUser) {
            await markMessagesAsRead(conversationId, currentUser.id);
          }
          
          // Setup real-time subscriptions
          const newMsgSubscription = subscribeToConversationMessages(
            conversationId,
            newMessage => {
              if (!sentMessagesRef.current.has(String(newMessage.id))) {
                sentMessagesRef.current.add(String(newMessage.id));
                setMessages(prev => [...prev, newMessage]);
                
                if (currentUser && newMessage.sender_id !== currentUser.id) {
                  markMessagesAsRead(conversationId, currentUser.id);
                }
              }
            }
          );
          
          const updateSubscription = subscribeToMessageUpdates(
            conversationId,
            updatedMessage => {
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === updatedMessage.id ? updatedMessage : msg
                )
              );
            }
          );
          
          messageSubscriptionRef.current = newMsgSubscription;
          updateSubscriptionRef.current = updateSubscription;
        }
      } catch (err) {
        console.error('Error loading messages:', err);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    };
    
    loadData();
    
    return () => {
      // Clean up subscriptions
      if (messageSubscriptionRef.current) unsubscribe(messageSubscriptionRef.current);
      if (updateSubscriptionRef.current) unsubscribe(updateSubscriptionRef.current);
    };
  }, [conversationId]);
  
  // Function to load more (older) messages
  const handleLoadMore = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    
    try {
      setLoadingMore(true);
      const oldestMessageId = messages[0].id;
      
      // Get older messages
      const olderMessages = await getConversationMessages(conversationId, MESSAGES_PER_PAGE, oldestMessageId);
      
      // Track loaded message IDs
      olderMessages.forEach(msg => {
        sentMessagesRef.current.add(String(msg.id));
      });
      
      // Check if there are even more messages
      if (olderMessages.length > 0) {
        const newOldestId = olderMessages[0].id;
        const moreAvailable = await hasOlderMessages(conversationId, newOldestId);
        setHasMore(moreAvailable);
        
        // Update messages (prepend older messages)
        setMessages(prevMessages => [...olderMessages, ...prevMessages]);
      } else {
        // No more messages to load
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };
  
  // Format messages function
  const formatMessages = () => {
    if (!user || !messages.length) return [];
    
    let currentDate = '';
    
    return messages.map(msg => {
      const msgDate = new Date(msg.created_at);
      const smartDate = getSmartDate(msgDate);
      const showDateSeparator = smartDate !== currentDate;
      
      if (showDateSeparator) {
        currentDate = smartDate;
      }
      
      const uniqueKey = `${msg.id}-${msgDate.getTime()}`;
      
      let status = 'sent';
      if (msg.sender_id === user.id) {
        status = msg.is_read ? 'read' : 'sent';
      }
      
      return {
        id: uniqueKey,
        originalId: String(msg.id),
        text: msg.message_text,
        sender: msg.sender_id === user.id ? 'me' : 'other',
        time: formatMessageTime(msgDate),
        status: status,
        dateSeparator: showDateSeparator ? smartDate : null
      };
    });
  };
  
  // Send message function
  const handleSendMessage = async () => {
    const text = input.trim();
    if (!text || !conversationId) return;
    
    try {
      setSending(true);
      setInput('');
      await sendMessage(conversationId, text);
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };
  
  // Render header for "Load More" button
  const renderHeader = () => {
    if (!hasMore) return null;
    
    return (
      <TouchableOpacity 
        style={styles.loadMoreButton} 
        onPress={handleLoadMore}
        disabled={loadingMore}
      >
        {loadingMore ? (
          <ActivityIndicator size="small" color={MAROON} />
        ) : (
          <Text style={styles.loadMoreText}>Load more messages</Text>
        )}
      </TouchableOpacity>
    );
  };
  
  // Render date separator and message bubble
  const renderItem = ({ item, index }) => {
    return (
      <>
        {item.dateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{item.dateSeparator}</Text>
          </View>
        )}
        <ChatBubble message={item} />
      </>
    );
  };
  
  // Scroll to bottom on new messages, but only if we're already at the bottom
  // or if it's our own message
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= 
      contentSize.height - paddingToBottom;
      
    setIsAtBottom(isCloseToBottom);
  };
  
  useEffect(() => {
    // Only auto-scroll if we're at the bottom or during initial load
    if ((messages.length > 0 && isAtBottom) || initialLoad) {
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: !initialLoad });
        }
      }, 200);
    }
  }, [messages, initialLoad]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['bottom']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
      >
        <View style={{ flex: 1 }}>
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
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.messagesList}
              ListHeaderComponent={renderHeader}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
              }
              onScroll={handleScroll}
              scrollEventThrottle={400}
              inverted={false} // This is important - we're not using inverted list
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    backgroundColor: '#fff',
  },
  backBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12,
    backgroundColor: '#f2f2f2',
  },
  headerName: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#222',
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

  messagesList: {
    paddingHorizontal: 16, 
    paddingVertical: 10,
    paddingBottom: 16,
  },
  
  inputWrap: {
    padding: 12,
    paddingRight: 66,
    borderTopWidth: 1, 
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
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
  
  // New styles for loading more
  loadMoreButton: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    color: MAROON,
    fontSize: 14,
    fontWeight: '600',
  },
  
  // New styles for date separators
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#888',
    backgroundColor: '#f0f0f0',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
});