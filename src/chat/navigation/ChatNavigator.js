// navigation/ChatNavigator.jsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MessagesListScreen from '../screens/MessageListScreen';
import ChatScreen from '../screens/ChatScreen';

const Stack = createNativeStackNavigator();

export default function ChatNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="MessagesList"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="MessagesList" component={MessagesListScreen} />
      <Stack.Screen name="ChatScreen" component={ChatScreen} />
    </Stack.Navigator>
  );
}
