import { supabase } from '../../services/supabase';
import { getCurrentUser } from '../utils/userUtils';

/**
 * Get or create a conversation for a specific booking
 * @param {string} bookingId - The booking ID
 * @param {string} conversationType - Type of booking ('package_booking' or 'ride_booking')
 * @param {string} subject - Conversation subject
 * @returns {Promise<object>} Conversation object
 */
export const getOrCreateBookingConversation = async (bookingId, conversationType, subject) => {
  try {
    // Check if conversation already exists for this booking
    const { data: existingConversation, error: findError } = await supabase
      .from('conversations')
      .select('*')
      .eq('related_id', bookingId)
      .eq('conversation_type', conversationType)
      .single();

    if (findError && findError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error finding conversation:', findError);
      throw findError;
    }

    // If conversation exists, return it
    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    const { data: newConversation, error: createError } = await supabase
      .from('conversations')
      .insert([
        {
          conversation_type: conversationType,
          related_id: bookingId,
          subject: subject,
          status: 'active'
        }
      ])
      .select()
      .single();

    if (createError) {
      console.error('Error creating conversation:', createError);
      throw createError;
    }

    return newConversation;
  } catch (err) {
    console.error('Error in getOrCreateBookingConversation:', err);
    throw err;
  }
};

/**
 * Add a participant to a conversation
 * @param {number} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @param {string} role - Role ('tourist', 'driver', etc.)
 */
export const addParticipantIfNeeded = async (conversationId, userId, role) => {
  try {
    // Check if participant already exists
    const { data: existingParticipant, error: findError } = await supabase
      .from('conversation_participants')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (findError && findError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error finding participant:', findError);
      return;
    }

    // If participant exists, no need to add
    if (existingParticipant) {
      return;
    }

    // Add participant
    const { error: addError } = await supabase
      .from('conversation_participants')
      .insert([
        {
          conversation_id: conversationId,
          user_id: userId,
          role: role
        }
      ]);

    if (addError) {
      console.error('Error adding participant:', addError);
    }
  } catch (err) {
    console.error('Error in addParticipantIfNeeded:', err);
  }
};

/**
 * Get messages for a conversation
 * @param {number} conversationId - Conversation ID
 * @param {number} limit - Max number of messages to retrieve
 * @returns {Promise<Array>} Messages array
 */
export const getConversationMessages = async (conversationId, limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        sender_id,
        message_text,
        created_at,
        is_read,
        users:sender_id (
          id,
          role,
          profile_photo_url,
          name
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getConversationMessages:', err);
    return [];
  }
};

/**
 * Send a message in a conversation
 * @param {number} conversationId - Conversation ID
 * @param {string} text - Message text
 * @returns {Promise<object>} The sent message
 */
export const sendMessage = async (conversationId, text) => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error('No user logged in');
    }

    // Check conversation status first
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('status, conversation_type, related_id')
      .eq('id', conversationId)
      .single();
      
    if (convError) {
      console.error('Error getting conversation:', convError);
      throw convError;
    }
    
    // Check if conversation is already ended
    if (conversation.status !== 'active') {
      throw new Error('This conversation has ended');
    }
    
    // Check if booking is still active
    const bookingActive = await isBookingActive(
      conversation.related_id, 
      conversation.conversation_type
    );
    
    if (!bookingActive) {
      // Update conversation status to ended
      await supabase
        .from('conversations')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', conversationId);
        
      throw new Error('This booking has been completed or cancelled');
    }

    // Proceed with sending the message
    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          sender_id: currentUser.id,
          message_text: text
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      throw error;
    }

    // Update conversation's updated_at timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  } catch (err) {
    console.error('Error in sendMessage:', err);
    throw err;
  }
};

/**
 * Mark messages as read
 * @param {number} conversationId - Conversation ID
 * @param {string} userId - Current user ID
 */
export const markMessagesAsRead = async (conversationId, userId) => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking messages as read:', error);
    }
  } catch (err) {
    console.error('Error in markMessagesAsRead:', err);
  }
};

/**
 * Subscribe to new messages in a conversation
 * @param {number} conversationId - Conversation ID
 * @param {function} onNewMessage - Callback for new messages
 * @returns {object} Subscription object
 */
export const subscribeToConversationMessages = (conversationId, onNewMessage) => {
  if (!conversationId) return null;
  
  const subscription = supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, payload => {
      if (onNewMessage && payload.new) {
        // Fetch user details for the message
        supabase
          .from('public_user_profiles')
          .select('id, role, profile_photo_url, name')
          .eq('id', payload.new.sender_id)
          .single()
          .then(({ data }) => {
            onNewMessage({
              ...payload.new,
              users: data
            });
          });
      }
    })
    .subscribe();
    
  return subscription;
};

/**
 * Unsubscribe from a channel
 * @param {object} subscription - Subscription object
 */
export const unsubscribe = (subscription) => {
  if (subscription) {
    supabase.removeChannel(subscription);
  }
};

/**
 * Get contact person ID (driver or owner) for a booking/request
 * @param {string} bookingId - The booking/request ID
 * @param {string} bookingType - Type of booking
 * @param {object} context - Additional context data
 * @returns {Promise<string|null>} Contact person ID or null
 */
export const getContactPersonId = async (bookingId, bookingType, context = {}) => {
  try {
    console.log(`Looking up contact person for ${bookingType} with ID: ${bookingId}`);
    
    // Extract context info
    const { packageId, eventId, participantRole } = context;
    
    // Determine which table and field to query based on booking type
    let table, idField;
    
    if (bookingType === 'custom_tour_package') {
      table = 'custom_tour_packages';
      idField = 'driver_id';
      
      // If packageId is provided, query by packageId instead
      if (packageId) {
        return await getPackageContactPerson(packageId, 'custom_tour_package');
      }
    } 
    else if (bookingType === 'special_event_request') {
      table = 'special_event_requests';
      idField = 'owner_id';
      
      // If eventId is provided, query by eventId instead
      if (eventId) {
        return await getPackageContactPerson(eventId, 'special_event_request');
      }
    } 
    else {
      console.log(`Unknown booking type: ${bookingType}, trying direct lookup`);
      
      // Try a direct lookup based on participantRole
      if (participantRole === 'driver') {
        return await getRequestDriverId(bookingId);
      } else if (participantRole === 'owner') {
        return await getRequestOwnerId(bookingId);
      }
      
      return null;
    }
    
    // Rest of function remains the same
    // ...
  } catch (err) {
    console.error('Error in getContactPersonId:', err);
    return null;
  }
};

/**
 * Helper to get driver/owner ID from a package/event
 */
const getPackageContactPerson = async (id, type) => {
  if (!id) return null;
  
  try {
    const table = type === 'custom_tour_package' ? 'custom_tour_packages' : 'special_event_requests';
    const idField = type === 'custom_tour_package' ? 'driver_id' : 'owner_id';
    
    const { data, error } = await supabase
      .from(table)
      .select(idField)
      .eq('id', id)
      .single();
      
    if (error) {
      console.error(`Error getting contact person for ${type}:`, error);
      return null;
    }
    
    return data?.[idField] || null;
  } catch (err) {
    console.error('Error in getPackageContactPerson:', err);
    return null;
  }
};

/**
 * Try to get driver ID from custom request
 */
const getRequestDriverId = async (requestId) => {
  try {
    const { data, error } = await supabase
      .from('custom_tour_requests')
      .select('custom_tour_package:custom_tour_package_id(driver_id)')
      .eq('id', requestId)
      .single();
      
    if (error || !data?.custom_tour_package?.driver_id) {
      return null;
    }
    
    return data.custom_tour_package.driver_id;
  } catch (err) {
    console.error('Error getting driver ID:', err);
    return null;
  }
};

/**
 * Try to get owner ID from special event request
 */
const getRequestOwnerId = async (requestId) => {
  try {
    const { data, error } = await supabase
      .from('custom_tour_requests')
      .select('special_event_request:special_event_request_id(owner_id)')
      .eq('id', requestId)
      .single();
      
    if (error || !data?.special_event_request?.owner_id) {
      return null;
    }
    
    return data.special_event_request.owner_id;
  } catch (err) {
    console.error('Error getting owner ID:', err);
    return null;
  }
};

/**
 * Get user info by ID
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} User object or null
 */
export const getUserInfo = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('public_user_profiles')
      .select('id, role, profile_photo_url, name')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Error getting user info:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Error in getUserInfo:', err);
    return null;
  }
};

/**
 * Check if a booking is active (not completed or cancelled)
 * @param {string} bookingId - The booking ID
 * @param {string} bookingType - Type of booking
 * @returns {Promise<boolean>} True if booking is active, false otherwise
 */
export const isBookingActive = async (bookingId, bookingType) => {
  try {
    let table;
    
    if (bookingType === 'custom_tour_package') {
      table = 'custom_tour_requests';
    } else if (bookingType === 'special_event_request') {
      table = 'special_event_requests';
    } else if (bookingType === 'package_booking') {
      table = 'bookings';
    } else {
      return false;
    }
    
    const { data, error } = await supabase
      .from(table)
      .select('status')
      .eq('id', bookingId)
      .single();
      
    if (error) {
      console.error(`Error checking booking status:`, error);
      return false;
    }
    
    // Check if status is active (not completed or cancelled)
    const status = data?.status?.toLowerCase();
    return status !== 'completed' && 
           status !== 'cancelled' && 
           status !== 'rejected';
  } catch (err) {
    console.error('Error in isBookingActive:', err);
    return false;
  }
};