import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatBubble } from '../../components';
import { formatMessageTime, getSmartDate } from '../../utils/dateTimeUtils';
import { 
  getOrCreateBookingConversation, 
  addParticipantIfNeeded,
  getConversationMessages,
  sendMessage as sendChatMessage,
  markMessagesAsRead,
  subscribeToConversationMessages,
  unsubscribe,
  getContactPersonId,
  getUserInfo
} from '../../services/chatService';
import { getCurrentUser } from '../../utils/userUtils';

const MAROON = '#6B2E2B';

function BackBtn({ onPress }) {
  return (
    <TouchableOpacity style={styles.backBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="arrow-back" size={22} color={MAROON} />
    </TouchableOpacity>
  );
}

export default function ChatRoom({ route, navigation }) {
  // Updated parameter destructuring with better defaults
  const { 
    bookingId, 
    subject, 
    contactName, 
    participantRole = 'unknown',
    requestType = 'custom_tour_package',
    packageId = null,
    eventId = null 
  } = route.params || {};

  // Convert any "undefined" string values to null
  const safePackageId = packageId === undefined || packageId === "undefined" ? null : packageId;
  const safeEventId = eventId === undefined || eventId === "undefined" ? null : eventId;
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [user, setUser] = useState(null);
  const [contactInfo, setContactInfo] = useState(null);
  
  const flatListRef = useRef(null);
  const messageSubscriptionRef = useRef(null);
  const sentMessagesRef = useRef(new Set());
  
  // Set up conversation and load messages
  useEffect(() => {
    let isMounted = true;
    
    const setupConversation = async () => {
      try {
        setLoading(true);
        console.log(`Setting up chat for ${requestType} with ID: ${bookingId}`);
        
        // Get current user
        const currentUser = await getCurrentUser();
        if (isMounted) setUser(currentUser);
        
        if (!bookingId || !currentUser) {
          setLoading(false);
          return;
        }
        
        // Use the provided requestType directly
        const bookingType = requestType;
        
        // Get or create the conversation
        const conversationData = await getOrCreateBookingConversation(
          bookingId, 
          bookingType, 
          subject || `Booking Conversation`
        );
        
        if (isMounted) setConversation(conversationData);
        // Determine current user's role based on userRole parameter or stored role
        let currentUserRole = 'tourist'; // Default
        const userRole = route.params?.userRole;

        // If userRole is explicitly set, use that
        if (userRole) {
          currentUserRole = userRole;
          console.log(`Using explicit userRole: ${currentUserRole}`);
        } 
        // Otherwise use the user's stored role if available
        else if (currentUser.role) {
          currentUserRole = currentUser.role;
          console.log(`Using user's stored role: ${currentUserRole}`);
        }

        // Add current user with the correct role
        console.log(`Adding current user ${currentUser.id} with role ${currentUserRole}`);        
        // Add current user as participant
        await addParticipantIfNeeded(
          conversationData.id,
          currentUser.id,
          currentUserRole
        );
        
        // Get contact person ID based on requestType and pass additional context
        const contactPersonId = await getContactPersonId(
          bookingId, 
          bookingType, 
          {
            packageId: safePackageId,
            eventId: safeEventId,
            participantRole: otherParticipantRole
          }
        );

        // Determine the role of the other participant based on the current user's role
        let otherParticipantRole = participantRole;
        if (currentUserRole === 'driver' || currentUserRole === 'owner') {
          otherParticipantRole = 'tourist';
          console.log(`Current user is ${currentUserRole}, other participant role set to tourist`);
        } else if (currentUserRole === 'tourist') {
          // Keep the role that was passed in participantRole
          console.log(`Current user is tourist, other participant role is ${otherParticipantRole}`);
        }
        
        if (contactPersonId) {
          console.log(`Adding contact person ${contactPersonId} with role ${participantRole}`);
          
          // Use the actual role from participantRole
          await addParticipantIfNeeded(
            conversationData.id,
            contactPersonId,
            participantRole // Use the passed role
          );
          
          // Get contact person info
          const contactPerson = await getUserInfo(contactPersonId);
          if (isMounted) setContactInfo(contactPerson);
        }
        
        // Load messages
        const messageData = await getConversationMessages(conversationData.id);
        console.log(`Loaded ${messageData.length} messages`);
        
        // Track loaded message IDs
        messageData.forEach(msg => {
          sentMessagesRef.current.add(String(msg.id));
        });
        
        if (isMounted) setMessages(messageData);
        
        // Mark messages as read
        await markMessagesAsRead(conversationData.id, currentUser.id);
        
        // Set up real-time subscription
        const subscription = subscribeToConversationMessages(
          conversationData.id,
          (newMessage) => {
            // Check if we've already processed this message
            if (!sentMessagesRef.current.has(String(newMessage.id))) {
              sentMessagesRef.current.add(String(newMessage.id));
              
              if (isMounted) {
                setMessages(prev => [...prev, newMessage]);
                
                // Mark messages from others as read
                if (currentUser && newMessage.sender_id !== currentUser.id) {
                  markMessagesAsRead(conversationData.id, currentUser.id);
                }
              }
            }
          }
        );
        
        messageSubscriptionRef.current = subscription;
      } catch (err) {
        console.error('Error setting up conversation:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    setupConversation();
    
    return () => {
      isMounted = false;
      if (messageSubscriptionRef.current) {
        unsubscribe(messageSubscriptionRef.current);
      }
    };
  }, [bookingId, subject, requestType, safePackageId, safeEventId, participantRole]);
  
  // Format messages for display
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
      
      // Get sender name using the name field from public_user_profiles
      let senderName = displayContactName;
      if (msg.users && msg.users.name) {
        senderName = msg.users.name;
      }
      
      return {
        id: String(msg.id),
        text: msg.message_text || '(No message content)',
        sender: msg.sender_id === user.id ? 'me' : 'other',
        senderName: msg.sender_id === user.id ? '' : senderName,
        senderPhoto: msg.users?.profile_photo_url || null,
        time: formatMessageTime(msgDate),
        status: msg.is_read ? 'read' : 'sent',
        dateSeparator: showDateSeparator ? smartDate : null
      };
    });
  };
  
  // Send a message
  const handleSendMessage = async () => {
    const text = input.trim();
    if (!text || !conversation) return;
    
    try {
      setSending(true);
      setInput('');
      
      // Send to server and wait for real-time update
      await sendChatMessage(conversation.id, text);
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };
  
  // Render message item
  const renderItem = ({ item }) => {
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
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [messages]);

  // Get appropriate contact label based on role
  const getContactLabel = () => {
    if (participantRole === 'driver') return 'Driver';
    if (participantRole === 'owner') return 'Owner';
    return 'Contact';
  };

  // Display contact name with appropriate role label
  const contactLabel = getContactLabel();
  const displayContactName = contactInfo ? 
    contactInfo.name : 
    contactName || contactLabel;

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
              <Text style={styles.headerDriver} numberOfLines={1}>
                Chat with {displayContactName}
              </Text>
            </View>
          </View>

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
              ListEmptyComponent={
                <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
              }
            />
          )}

          {/* Input */}
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
  headerDriver: { 
    fontSize: 12,
    color: '#666'
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