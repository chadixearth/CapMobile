import { supabase } from '../../services/supabase';
import { getCurrentUser } from '../utils/userUtils';

/**
 * Get messages for a specific conversation with pagination
 * @param {number} conversationId - The conversation ID
 * @param {number} limit - Maximum number of messages to fetch (default 20)
 * @param {number} beforeId - Get messages before this message ID (for pagination)
 * @returns {Promise<Array>} List of messages
 */
export const getConversationMessages = async (conversationId, limit = 20, beforeId = null) => {
  try {
    let query = supabase
      .from('support_messages')
      .select(`
        id,
        message_text,
        sender_id,
        created_at,
        is_read
      `)
      .eq('support_conversation_id', conversationId)
      .order('created_at', { ascending: false }) // Newest first for pagination
      .limit(limit);
      
    // If beforeId is provided, add pagination constraint
    if (beforeId) {
      query = query.lt('id', beforeId); // Get messages with ID less than beforeId
    }
      
    const { data, error } = await query;
      
    if (error) {
      console.error('Error fetching messages:', error.message);
      return [];
    }
    
    // Return in ascending order (oldest first) for display
    return data ? data.reverse() : [];
  } catch (err) {
    console.error('Error in getConversationMessages:', err.message);
    return [];
  }
};

/**
 * Check if there are older messages available
 * @param {number} conversationId - The conversation ID
 * @param {number} oldestMessageId - The oldest message ID we currently have
 * @returns {Promise<boolean>} True if there are older messages
 */
export const hasOlderMessages = async (conversationId, oldestMessageId) => {
  try {
    const { count, error } = await supabase
      .from('support_messages')
      .select('id', { count: 'exact', head: true })
      .eq('support_conversation_id', conversationId)
      .lt('id', oldestMessageId);
      
    if (error) {
      console.error('Error checking older messages:', error.message);
      return false;
    }
    
    return count > 0;
  } catch (err) {
    console.error('Error in hasOlderMessages:', err.message);
    return false;
  }
};

/**
 * Send a new message in a conversation
 * @param {number} conversationId - The conversation ID
 * @param {string} messageText - The message content
 * @returns {Promise<Object|null>} The new message or null on error
 */
export const sendMessage = async (conversationId, messageText) => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await supabase
      .from('support_messages')
      .insert([
        {
          support_conversation_id: conversationId,
          sender_id: user.id,
          message_text: messageText,
        }
      ])
      .select()
      .single();
      
    if (error) {
      console.error('Error sending message:', error.message);
      return null;
    }
    
    // Also update the conversation's updated_at timestamp
    await supabase
      .from('support_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    
    return data;
  } catch (err) {
    console.error('Error in sendMessage:', err.message);
    return null;
  }
};

/**
 * Mark messages as read
 * @param {number} conversationId - The conversation ID
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} Success status
 */
export const markMessagesAsRead = async (conversationId, userId) => {
  try {
    if (!conversationId || !userId) return false;
    
    const { error } = await supabase
      .from('support_messages')
      .update({ is_read: true })
      .eq('support_conversation_id', conversationId)
      .neq('sender_id', userId);
    
    if (error) {
      console.error('Error marking messages as read:', error.message);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error in markMessagesAsRead:', err.message);
    return false;
  }
};

/**
 * Check if conversation has unread messages
 * @param {number} conversationId - The conversation ID
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} Whether there are unread messages
 */
export const hasUnreadMessages = async (conversationId, userId) => {
  try {
    const { count, error } = await supabase
      .from('support_messages')
      .select('id', { count: 'exact', head: true })
      .eq('support_conversation_id', conversationId)
      .eq('is_read', false)
      .neq('sender_id', userId);
    
    if (error) {
      console.error('Error checking unread messages:', error.message);
      return false;
    }
    
    return count > 0;
  } catch (err) {
    console.error('Error in hasUnreadMessages:', err.message);
    return false;
  }
};
