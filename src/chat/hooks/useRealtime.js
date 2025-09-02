import { useEffect, useRef } from 'react';
import { 
  subscribeToConversationMessages, 
  subscribeToConversationUpdates,
  subscribeToUserConversations,
  unsubscribe
} from '../services';

// /**
//  * Hook to subscribe to real-time message updates
//  * @param {number} conversationId - The conversation ID to subscribe to
//  * @param {function} onNewMessage - Callback for new messages
//  * @param {array} deps - Dependency array for useEffect
//  */
// export const useRealtimeMessages = (conversationId, onNewMessage, deps = []) => {
//   const subscriptionRef = useRef(null);
//   // Track message IDs we've already processed
//   const processedIds = useRef(new Set());
  
//   useEffect(() => {
//     if (!conversationId) return;
    
//     // Clear processed IDs when conversation changes
//     processedIds.current.clear();
    
//     // Subscribe to real-time updates
//     const subscription = subscribeToConversationMessages(
//       conversationId,
//       (newMessage) => {
//         // Convert ID to string for consistent comparison
//         const messageId = String(newMessage.id);
        
//         // Debug logging
//         console.log(`Received message: ${messageId}, Already processed: ${processedIds.current.has(messageId)}`);
        
//         // Skip if we've already processed this message ID
//         if (processedIds.current.has(messageId)) {
//           console.log(`Skipping duplicate message: ${messageId}`);
//           return;
//         }
        
//         // Add to our processed set
//         processedIds.current.add(messageId);
        
//         // Call the callback with the new message
//         onNewMessage(newMessage);
//       }
//     );
    
//     subscriptionRef.current = subscription;
    
//     // Cleanup on unmount
//     return () => {
//       console.log('Cleaning up message subscription');
//       unsubscribe(subscriptionRef.current);
//       subscriptionRef.current = null;
//     };
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [conversationId, ...deps]);
  
//   // Return methods to work with the processed IDs
//   return {
//     addProcessedId: (id) => processedIds.current.add(String(id)),
//     hasProcessedId: (id) => processedIds.current.has(String(id)),
//     clearProcessedIds: () => processedIds.current.clear()
//   };
// };

// /**
//  * Hook to subscribe to conversation status updates
//  * @param {number} conversationId - The conversation ID to subscribe to
//  * @param {function} onUpdate - Callback for conversation updates
//  * @param {array} deps - Dependency array for useEffect
//  */
// export const useConversationUpdates = (conversationId, onUpdate, deps = []) => {
//   const subscriptionRef = useRef(null);
  
//   useEffect(() => {
//     if (!conversationId) return;
    
//     // Subscribe to status updates
//     const subscription = subscribeToConversationUpdates(
//       conversationId,
//       onUpdate
//     );
    
//     subscriptionRef.current = subscription;
    
//     // Cleanup on unmount
//     return () => {
//       unsubscribe(subscriptionRef.current);
//     };
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [conversationId, ...deps]);
// };

/**
 * Hook to subscribe to user's conversation list updates
 * @param {string} userId - The user ID to monitor
 * @param {function} onConversationChange - Callback for conversation changes
 * @param {array} deps - Dependency array for useEffect
 */
export const useUserConversations = (userId, onConversationChange, deps = []) => {
  const subscriptionRef = useRef(null);
  
  useEffect(() => {
    if (!userId) return;
    
    // Subscribe to user's conversations
    const subscription = subscribeToUserConversations(
      userId,
      onConversationChange
    );
    
    subscriptionRef.current = subscription;
    
    // Cleanup on unmount
    return () => {
      unsubscribe(subscriptionRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ...deps]);
};