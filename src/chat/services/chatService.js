import { supabase } from '../../services/supabase';
import { getCurrentUser } from '../utils/userUtils';

/**
 * Get all support conversations for the current user
 * @returns {Promise<Array>} List of conversations
 */
export const getUserConversations = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('support_conversations')
      .select(`
        id, 
        subject, 
        status, 
        created_at, 
        updated_at,
        admin_id
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching conversations:', error.message);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error in getUserConversations:', err.message);
    return [];
  }
};

/**
 * Create a new support conversation
 * @param {string} subject - The issue subject
 * @returns {Promise<Object|null>} The new conversation or null on error
 */
export const createConversation = async (subject) => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    // For now, use a default admin ID - in production you'd have a way to assign this
    const DEFAULT_ADMIN_ID = '00000000-0000-0000-0000-000000000000'; // Replace with actual admin ID
    
    const { data, error } = await supabase
      .from('support_conversations')
      .insert([
        {
          user_id: user.id,
          admin_id: DEFAULT_ADMIN_ID, // This should be assigned by your backend in reality
          subject: subject,
          status: 'open',
        }
      ])
      .select()
      .single();
      
    if (error) {
      console.error('Error creating conversation:', error.message);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Error in createConversation:', err.message);
    return null;
  }
};

/**
 * Get messages for a specific conversation
 * @param {number} conversationId - The conversation ID
 * @returns {Promise<Array>} List of messages
 */
export const getConversationMessages = async (conversationId) => {
  try {
    const { data, error } = await supabase
      .from('support_messages')
      .select(`
        id,
        message_text,
        sender_id,
        created_at,
        is_read
      `)
      .eq('support_conversation_id', conversationId)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error('Error fetching messages:', error.message);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error in getConversationMessages:', err.message);
    return [];
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