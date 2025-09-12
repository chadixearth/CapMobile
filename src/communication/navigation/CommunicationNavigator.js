// navigation/ChatNavigator.jsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatRoom from '../chatbooking/screens/chatRoom';

const Stack = createNativeStackNavigator();

export default function CommunicationNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="ChatRoom"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="ChatRoom" component={ChatRoom} />
    </Stack.Navigator>
  );
}
