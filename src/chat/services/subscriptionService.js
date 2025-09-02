import { supabase } from '../../services/supabase';

/**
 * Subscribe to real-time messages for a specific conversation
 * @param {number} conversationId - The conversation ID to subscribe to
 * @param {function} onMessage - Callback function when new message arrives
 * @returns {object} Subscription object that can be used to unsubscribe
 */
export const subscribeToConversationMessages = (conversationId, onMessage) => {
  if (!conversationId) return null;

  // Force unique channel name with timestamp to avoid conflicts
  const channelName = `messages-${conversationId}-${Date.now()}`;

  // Remove any existing channels for this conversation
  const existingChannels = supabase.getChannels();
  existingChannels.forEach(channel => {
    if (channel.topic.includes(`messages-${conversationId}`)) {
      console.log(`Removing existing channel: ${channel.topic}`);
      supabase.removeChannel(channel);
    }
  });
  
  console.log(`Creating new subscription channel: ${channelName}`);
  
  // Create a new subscription with logging
  const subscription = supabase
    .channel(channelName)
    .on('postgres_changes', 
      {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `support_conversation_id=eq.${conversationId}`
      },
      payload => {
        console.log(`New message from subscription: ${payload.new.id}`);
        if (onMessage && payload.new) {
          onMessage(payload.new);
        }
      }
    )
    .subscribe((status) => {
      console.log(`Subscription status for ${channelName}:`, status);
    });
    
  return subscription;
};

/**
 * Subscribe to message updates (when messages are read)
 * @param {number} conversationId - The conversation ID to subscribe to
 * @param {function} onUpdate - Callback function when a message is updated
 * @returns {object} Subscription object that can be used to unsubscribe
 */
export const subscribeToMessageUpdates = (conversationId, onUpdate) => {
  if (!conversationId) return null;
  
  const subscription = supabase
    .channel(`message-updates:${conversationId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'support_messages',
      filter: `support_conversation_id=eq.${conversationId}`
    }, payload => {
      if (onUpdate && payload.new) {
        onUpdate(payload.new);
      }
    })
    .subscribe();
    
  return subscription;
};

/**
 * Unsubscribe from a real-time subscription
 * @param {object} subscription - The subscription to remove
 */
export const unsubscribe = (subscription) => {
  try {
    if (!subscription) return;
    
    console.log(`Unsubscribing from channel`);
    supabase.removeChannel(subscription);
  } catch (err) {
    console.error('Error unsubscribing:', err);
  }
};