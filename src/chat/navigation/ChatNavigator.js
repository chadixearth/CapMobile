// navigation/ChatNavigator.jsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MessagesListScreen from '../screens/MessageListScreen';
import ChatScreen from '../screens/ChatScreen';
import SupportListScreen from '../chatsupport/screens/SupportListScreen';
import StartSupportChat from '../chatsupport/screens/StartSupportChat';
import SupportChatRoom from '../chatsupport/screens/SupportChatRoom';
const Stack = createNativeStackNavigator();

export default function ChatNavigator() {
  return (
    // <Stack.Navigator
    //   initialRouteName="MessagesList"
    //   screenOptions={{ headerShown: false }}
    // >
    //   <Stack.Screen name="MessagesList" component={MessagesListScreen} />
    //   <Stack.Screen name="ChatScreen" component={ChatScreen} />
    //   <Stack.Screen name="SupportList" component={SupportListScreen} />
    //   <Stack.Screen name="StartSupportChat" component={StartSupportChat} />
    //   <Stack.Screen name="SupportChatRoom" component={SupportChatRoom} />
    // </Stack.Navigator>
    <Stack.Navigator
      initialRouteName="SupportList"
      screenOptions={{ headerShown: false }}
    >
      {/* <Stack.Screen name="MessagesList" component={MessagesListScreen} />
      <Stack.Screen name="ChatScreen" component={ChatScreen} /> */}
      <Stack.Screen name="SupportList" component={SupportListScreen} />
      <Stack.Screen name="StartSupportChat" component={StartSupportChat} />
      <Stack.Screen name="SupportChatRoom" component={SupportChatRoom} />
    </Stack.Navigator>
  );
}
