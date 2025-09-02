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

// /**
//  * FIXED ADMIN
//  * Create a new support conversation
//  * This function assigns a fixed admin to a new support conversation
//  * @param {string} subject - The conversation subject
//  * @returns {Promise<object|null>} Created conversation or null
//  */
// export const createConversation = async (subject) => {
//   try {
//     const user = await getCurrentUser();
//     if (!user) return null;

//     // In production, admin assignment should be handled by the backend
//     const DEFAULT_ADMIN_ID = '358193d8-11f9-4dca-867b-24ffff2e7ec1'; // Replace with actual admin ID

//     const { data, error } = await supabase
//       .from('support_conversations')
//       .insert([
//         {
//           user_id: user.id,
//           admin_id: DEFAULT_ADMIN_ID,
//           subject: subject, // Store as plain text
//           status: 'open'    // Explicitly set as open
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

/**
 * RANDOM ADMIN
 * Create a new support conversation
 * this function randomly assigns an admin to a new support conversation
 * Assigns a random admin from users with the 'admin' role
 * @param {string} subject - The conversation subject
 * @returns {Promise<object|null>} Created conversation or null
 */
export const createConversation = async (subject) => {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    // Fetch all admins from the view
    const { data: admins, error: adminError } = await supabase
      .from('public_user_profiles')
      .select('id')
      .eq('role', 'admin');

    if (adminError) {
      console.error('Error fetching admins:', adminError.message);
      return null;
    }

    if (!admins || admins.length === 0) {
      console.error('No admins available to assign.');
      return null;
    }

    // Pick a random admin
    const randomAdmin =
      admins[Math.floor(Math.random() * admins.length)];

    // Create conversation with randomly assigned admin
    const { data, error } = await supabase
      .from('support_conversations')
      .insert([
        {
          user_id: user.id,
          admin_id: randomAdmin.id,
          subject: subject,
          status: 'open',
        },
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
 * Subscribe to conversation status changes
 * @param {number} conversationId - The conversation ID to subscribe to
 * @param {function} onUpdate - Callback function when conversation is updated
 * @returns {object} Subscription object that can be used to unsubscribe
 */
export const subscribeToConversationUpdates = (conversationId, onUpdate) => {
  if (!conversationId) return null;
  
  const subscription = supabase
    .channel(`conversation:${conversationId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'support_conversations',
      filter: `id=eq.${conversationId}`
    }, payload => {
      if (onUpdate && payload.new) {
        onUpdate(payload.new);
      }
    })
    .subscribe();
    
  return subscription;
};

/**
 * Subscribe to new conversations for a user
 * @param {string} userId - User ID to monitor for new conversations
 * @param {function} onNewConversation - Callback function when a new conversation is created
 * @returns {object} Subscription object that can be used to unsubscribe
 */
export const subscribeToUserConversations = (userId, onNewConversation) => {
  if (!userId) return null;
  
  const subscription = supabase
    .channel(`user-conversations:${userId}`)
    .on('postgres_changes', {
      event: '*', // Both INSERT and UPDATE
      schema: 'public',
      table: 'support_conversations',
      filter: `user_id=eq.${userId}`
    }, payload => {
      if (onNewConversation && payload.new) {
        onNewConversation(payload.new, payload.eventType);
      }
    })
    .subscribe();
    
  return subscription;
};

/**
 * Get the current status of a conversation
 * @param {number} conversationId - The conversation ID
 * @returns {Promise<string|null>} Conversation status or null
 */
export const getConversationStatus = async (conversationId) => {
  try {
    if (!conversationId) return null;
    
    const { data, error } = await supabase
      .from('support_conversations')
      .select('status')
      .eq('id', conversationId)
      .single();
      
    if (error) {
      console.error('Error getting conversation status:', error.message);
      return null;
    }
    
    return data?.status || null;
  } catch (err) {
    console.error('Error in getConversationStatus:', err.message);
    return null;
  }
};