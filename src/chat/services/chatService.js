// import { supabase } from '../../services/supabase';
// import { getCurrentUser } from '../utils/userUtils';

// /**
//  * Get all support conversations for the current user
//  * @returns {Promise<Array>} List of conversations
//  */
// export const getUserConversations = async () => {
//   try {
//     const user = await getCurrentUser();
//     if (!user) return [];
    
//     const { data, error } = await supabase
//       .from('support_conversations')
//       .select(`
//         id, 
//         subject, 
//         status, 
//         created_at, 
//         updated_at,
//         admin_id
//       `)
//       .eq('user_id', user.id)
//       .order('updated_at', { ascending: false });
      
//     if (error) {
//       console.error('Error fetching conversations:', error.message);
//       return [];
//     }
    
//     return data || [];
//   } catch (err) {
//     console.error('Error in getUserConversations:', err.message);
//     return [];
//   }
// };

// /**
//  * Create a new support conversation
//  * @param {string} subject - The issue subject
//  * @returns {Promise<Object|null>} The new conversation or null on error
//  */
// export const createConversation = async (subject) => {
//   try {
//     const user = await getCurrentUser();
//     if (!user) throw new Error('User not authenticated');
    
//     // For now, use a default admin ID - in production you'd have a way to assign this
//     const DEFAULT_ADMIN_ID = '00000000-0000-0000-0000-000000000000'; // Replace with actual admin ID
    
//     const { data, error } = await supabase
//       .from('support_conversations')
//       .insert([
//         {
//           user_id: user.id,
//           admin_id: DEFAULT_ADMIN_ID, // This should be assigned by your backend in reality
//           subject: subject,
//           status: 'open',
//         }
//       ])
//       .select()
//       .single();
      
//     if (error) {
//       console.error('Error creating conversation:', error.message);
//       return null;
//     }
    
//     return data;
//   } catch (err) {
//     console.error('Error in createConversation:', err.message);
//     return null;
//   }
// };

// /**
//  * Get messages for a specific conversation with pagination
//  * @param {number} conversationId - The conversation ID
//  * @param {number} limit - Maximum number of messages to fetch (default 20)
//  * @param {number} beforeId - Get messages before this message ID (for pagination)
//  * @returns {Promise<Array>} List of messages
//  */
// export const getConversationMessages = async (conversationId, limit = 20, beforeId = null) => {
//   try {
//     let query = supabase
//       .from('support_messages')
//       .select(`
//         id,
//         message_text,
//         sender_id,
//         created_at,
//         is_read
//       `)
//       .eq('support_conversation_id', conversationId)
//       .order('created_at', { ascending: false }) // Newest first for pagination
//       .limit(limit);
      
//     // If beforeId is provided, add pagination constraint
//     if (beforeId) {
//       query = query.lt('id', beforeId); // Get messages with ID less than beforeId
//     }
      
//     const { data, error } = await query;
      
//     if (error) {
//       console.error('Error fetching messages:', error.message);
//       return [];
//     }
    
//     // Return in ascending order (oldest first) for display
//     return data ? data.reverse() : [];
//   } catch (err) {
//     console.error('Error in getConversationMessages:', err.message);
//     return [];
//   }
// };

// /**
//  * Check if there are older messages available
//  * @param {number} conversationId - The conversation ID
//  * @param {number} oldestMessageId - The oldest message ID we currently have
//  * @returns {Promise<boolean>} True if there are older messages
//  */
// export const hasOlderMessages = async (conversationId, oldestMessageId) => {
//   try {
//     const { count, error } = await supabase
//       .from('support_messages')
//       .select('id', { count: 'exact', head: true })
//       .eq('support_conversation_id', conversationId)
//       .lt('id', oldestMessageId);
      
//     if (error) {
//       console.error('Error checking older messages:', error.message);
//       return false;
//     }
    
//     return count > 0;
//   } catch (err) {
//     console.error('Error in hasOlderMessages:', err.message);
//     return false;
//   }
// };

// /**
//  * Send a new message in a conversation
//  * @param {number} conversationId - The conversation ID
//  * @param {string} messageText - The message content
//  * @returns {Promise<Object|null>} The new message or null on error
//  */
// export const sendMessage = async (conversationId, messageText) => {
//   try {
//     const user = await getCurrentUser();
//     if (!user) throw new Error('User not authenticated');
    
//     const { data, error } = await supabase
//       .from('support_messages')
//       .insert([
//         {
//           support_conversation_id: conversationId,
//           sender_id: user.id,
//           message_text: messageText,
//         }
//       ])
//       .select()
//       .single();
      
//     if (error) {
//       console.error('Error sending message:', error.message);
//       return null;
//     }
    
//     // Also update the conversation's updated_at timestamp
//     await supabase
//       .from('support_conversations')
//       .update({ updated_at: new Date().toISOString() })
//       .eq('id', conversationId);
    
//     return data;
//   } catch (err) {
//     console.error('Error in sendMessage:', err.message);
//     return null;
//   }
// };

// /**
//  * Mark messages as read
//  * @param {number} conversationId - The conversation ID
//  * @param {string} userId - The user ID
//  * @returns {Promise<boolean>} Success status
//  */
// export const markMessagesAsRead = async (conversationId, userId) => {
//   try {
//     if (!conversationId || !userId) return false;
    
//     const { error } = await supabase
//       .from('support_messages')
//       .update({ is_read: true })
//       .eq('support_conversation_id', conversationId)
//       .neq('sender_id', userId);
    
//     if (error) {
//       console.error('Error marking messages as read:', error.message);
//       return false;
//     }
    
//     return true;
//   } catch (err) {
//     console.error('Error in markMessagesAsRead:', err.message);
//     return false;
//   }
// };

// /**
//  * Check if conversation has unread messages
//  * @param {number} conversationId - The conversation ID
//  * @param {string} userId - The user ID
//  * @returns {Promise<boolean>} Whether there are unread messages
//  */
// export const hasUnreadMessages = async (conversationId, userId) => {
//   try {
//     const { count, error } = await supabase
//       .from('support_messages')
//       .select('id', { count: 'exact', head: true })
//       .eq('support_conversation_id', conversationId)
//       .eq('is_read', false)
//       .neq('sender_id', userId);
    
//     if (error) {
//       console.error('Error checking unread messages:', error.message);
//       return false;
//     }
    
//     return count > 0;
//   } catch (err) {
//     console.error('Error in hasUnreadMessages:', err.message);
//     return false;
//   }
// };

// /**
//  * ===== REAL-TIME SUBSCRIPTIONS =====
//  */

// /**
//  * Subscribe to real-time messages for a specific conversation
//  * @param {number} conversationId - The conversation ID to subscribe to
//  * @param {function} onMessage - Callback function when new message arrives
//  * @returns {object} Subscription object that can be used to unsubscribe
//  */
// export const subscribeToConversationMessages = (conversationId, onMessage) => {
//   if (!conversationId) return null;

//   // Force unique channel name with timestamp to avoid conflicts
//   const channelName = `messages-${conversationId}-${Date.now()}`;

//   // Remove any existing channels for this conversation
//   const existingChannels = supabase.getChannels();
//   existingChannels.forEach(channel => {
//     if (channel.topic.includes(`messages-${conversationId}`)) {
//       console.log(`Removing existing channel: ${channel.topic}`);
//       supabase.removeChannel(channel);
//     }
//   });
  
//   console.log(`Creating new subscription channel: ${channelName}`);
  
//   // Create a new subscription with logging
//   const subscription = supabase
//     .channel(channelName)
//     .on('postgres_changes', 
//       {
//         event: 'INSERT',
//         schema: 'public',
//         table: 'support_messages',
//         filter: `support_conversation_id=eq.${conversationId}`
//       },
//       payload => {
//         console.log(`New message from subscription: ${payload.new.id}`);
//         if (onMessage && payload.new) {
//           onMessage(payload.new);
//         }
//       }
//     )
//     .subscribe((status) => {
//       console.log(`Subscription status for ${channelName}:`, status);
//     });
    
//   return subscription;
// };

// /**
//  * Subscribe to conversation status changes
//  * @param {number} conversationId - The conversation ID to subscribe to
//  * @param {function} onUpdate - Callback function when conversation is updated
//  * @returns {object} Subscription object that can be used to unsubscribe
//  */
// export const subscribeToConversationUpdates = (conversationId, onUpdate) => {
//   if (!conversationId) return null;
  
//   const subscription = supabase
//     .channel(`conversation:${conversationId}`)
//     .on('postgres_changes', {
//       event: 'UPDATE',
//       schema: 'public',
//       table: 'support_conversations',
//       filter: `id=eq.${conversationId}`
//     }, payload => {
//       if (onUpdate && payload.new) {
//         onUpdate(payload.new);
//       }
//     })
//     .subscribe();
    
//   return subscription;
// };

// /**
//  * Subscribe to new conversations for a user
//  * @param {string} userId - User ID to monitor for new conversations
//  * @param {function} onNewConversation - Callback function when a new conversation is created
//  * @returns {object} Subscription object that can be used to unsubscribe
//  */
// export const subscribeToUserConversations = (userId, onNewConversation) => {
//   if (!userId) return null;
  
//   const subscription = supabase
//     .channel(`user-conversations:${userId}`)
//     .on('postgres_changes', {
//       event: '*', // Both INSERT and UPDATE
//       schema: 'public',
//       table: 'support_conversations',
//       filter: `user_id=eq.${userId}`
//     }, payload => {
//       if (onNewConversation && payload.new) {
//         onNewConversation(payload.new, payload.eventType);
//       }
//     })
//     .subscribe();
    
//   return subscription;
// };

// /**
//  * Subscribe to message updates (when messages are read)
//  * @param {number} conversationId - The conversation ID to subscribe to
//  * @param {function} onUpdate - Callback function when a message is updated
//  * @returns {object} Subscription object that can be used to unsubscribe
//  */
// export const subscribeToMessageUpdates = (conversationId, onUpdate) => {
//   if (!conversationId) return null;
  
//   const subscription = supabase
//     .channel(`message-updates:${conversationId}`)
//     .on('postgres_changes', {
//       event: 'UPDATE',
//       schema: 'public',
//       table: 'support_messages',
//       filter: `support_conversation_id=eq.${conversationId}`
//     }, payload => {
//       if (onUpdate && payload.new) {
//         onUpdate(payload.new);
//       }
//     })
//     .subscribe();
    
//   return subscription;
// };

// /**
//  * Unsubscribe from a real-time subscription
//  * @param {object} subscription - The subscription to remove
//  */
// export const unsubscribe = (subscription) => {
//   try {
//     if (!subscription) return;
    
//     console.log(`Unsubscribing from channel`);
//     supabase.removeChannel(subscription);
//   } catch (err) {
//     console.error('Error unsubscribing:', err);
//   }
// };
