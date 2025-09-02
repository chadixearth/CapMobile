import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
<<<<<<< HEAD
import { getUserConversations, hasUnreadMessages } from '../../services';
import { getCurrentUser } from '../../utils/userUtils';
import { getRelativeTime } from '../../utils/dateTimeUtils';
import { useUserConversations } from '../../hooks/useRealtime';
=======
import { getUserConversations, hasUnreadMessages } from '../../services/chatService';
import { getCurrentUser } from '../../utils/userUtils';
// import UserInfo from '../../components/UserInfo'; // Import the UserInfo component
>>>>>>> 069a124bff3b1c9ab25bd0bdba4bf1f39888a419

const MAROON = '#6B2E2B';

function BackBtn({ onPress }) {
  return (
    <TouchableOpacity style={styles.backBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="arrow-back" size={22} color={MAROON} />
    </TouchableOpacity>
  );
}

export default function SupportListScreen({ navigation }) {
  const [tab, setTab] = useState('open');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // Load initial conversations
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        
        if (currentUser) {
          await refreshConversations(currentUser.id);
        }
      } catch (err) {
        console.error('Error loading conversations:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadConversations();
  }, []);
  
  // Helper function to refresh conversations with unread status
  const refreshConversations = async (userId) => {
    if (!userId) return;
    
    // Get conversations
    const convos = await getUserConversations();
    
    // Make sure each ID is converted to string to prevent React key issues
    const uniqueConvos = Array.from(
      new Map(convos.map(item => [String(item.id), item])).values()
    );
    
    // Add unread status
    const convosWithUnread = await Promise.all(
      uniqueConvos.map(async (convo) => {
        const unread = await hasUnreadMessages(convo.id, userId);
        return { ...convo, hasUnread: unread };
      })
    );
    
    setConversations(convosWithUnread);
  };
  
  // Subscribe to conversation updates using custom hook
  useUserConversations(user?.id, async () => {
    // When any conversation is created or updated, refresh the whole list
    if (user?.id) {
      await refreshConversations(user.id);
    }
  }, []);
  
  // Filter conversations based on tab
  const openConversations = conversations.filter(c => c.status === 'open');
  const resolvedConversations = conversations.filter(c => c.status !== 'open');
  const hasActiveChat = openConversations.length > 0;
  
  // Format date for display
  const formatDate = (dateString) => {
    return getRelativeTime(dateString);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BackBtn onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Support / Help Center</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          onPress={() => setTab('open')}
          style={[styles.tab, tab === 'open' && styles.activeTab]}
        >
          <Text style={[styles.tabText, tab === 'open' && styles.activeTabText]}>
            Active Conversations
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setTab('resolved')}
          style={[styles.tab, tab === 'resolved' && styles.activeTab]}
        >
          <Text style={[styles.tabText, tab === 'resolved' && styles.activeTabText]}>
            Resolved Conversations
          </Text>
        </TouchableOpacity>
      </View>

      {/* Conversation List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={MAROON} size="large" />
        </View>
      ) : (
        <FlatList
          data={tab === 'open' ? openConversations : resolvedConversations}
          keyExtractor={item => `conversation-${String(item.id)}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('SupportChatRoom', { 
                conversationId: item.id,
                subject: item.subject, // Make sure it's used directly as a string
                status: item.status
              })}
            >
              <View style={styles.chatCard}>
                <View style={styles.chatCardContent}>
                  {/* Try to parse if it's JSON, otherwise use directly */}
                  <Text style={styles.chatTitle}>
                    {typeof item.subject === 'string' && item.subject.startsWith('{') 
                      ? JSON.parse(item.subject)?.issue || item.subject 
                      : item.subject}
                  </Text>
                  <Text style={styles.chatDate}>
                    {item.status === 'open' 
                      ? `Started ${formatDate(item.created_at)}` 
                      : `Resolved ${formatDate(item.updated_at)}`}
                  </Text>
                </View>
                {item.hasUnread && <View style={styles.unreadBadge} />}
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {tab === 'open' ? 'No active conversations.' : 'No resolved conversations.'}
            </Text>
          }
        />
      )}

      {/* New Chat Button */}
      {!hasActiveChat && tab === 'open' && !loading && (
        <TouchableOpacity
          style={styles.newChatBtn}
          onPress={() => navigation.navigate('StartSupportChat')}
        >
          <Text style={styles.newChatBtnText}>Start New Chat</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff'
  },
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222', // Changed from white to dark text
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: MAROON,
  },
  tabText: {
    color: '#888',
    fontWeight: '500',
  },
  activeTabText: {
    color: MAROON,
    fontWeight: 'bold',
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  chatCardContent: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  chatDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  chatMessage: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  chatStatus: {
    fontSize: 12,
    color: '#999',
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MAROON,
    marginRight: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 32,
  },
  newChatBtn: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: MAROON,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  newChatBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});