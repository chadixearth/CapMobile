// import React, { useEffect, useState } from 'react';
// import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
// import { getCurrentUser, getDisplayName } from '../utils/userUtils';

// const MAROON = '#6B2E2B';

// export default function UserInfo() {
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true);
  
//   useEffect(() => {
//     const loadUser = async () => {
//       try {
//         setLoading(true);
//         const userData = await getCurrentUser();
//         setUser(userData);
//       } catch (err) {
//         console.error('Error loading user:', err);
//       } finally {
//         setLoading(false);
//       }
//     };
    
//     loadUser();
//   }, []);

//   if (loading) {
//     return (
//       <View style={styles.container}>
//         <ActivityIndicator color={MAROON} size="small" />
//       </View>
//     );
//   }

//   const displayName = getDisplayName(user);
//   const isLoggedIn = !!user;

//   return (
//     <View style={styles.container}>
//       <Text style={styles.username}>
//         {isLoggedIn ? `Welcome, ${displayName}` : 'Not logged in'}
//       </Text>
//       {isLoggedIn && user.role && (
//         <Text style={styles.role}>Role: {user.role}</Text>
//       )}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     padding: 12,
//     backgroundColor: '#f2f2f2',
//     borderRadius: 8,
//     marginHorizontal: 16,
//     marginVertical: 8,
//     alignItems: 'flex-start',
//   },
//   username: {
//     fontSize: 16,
//     fontWeight: 'bold',
//     color: MAROON,
//   },
//   role: {
//     fontSize: 14,
//     color: '#666',
//     marginTop: 4,
//   },
// });