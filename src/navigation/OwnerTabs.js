import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import OwnerHomeScreen from '../screens/main/OwnerHomeScreen';
import OwnerBookScreen from '../screens/main/OwnerBookScreen';
import MenuScreen from '../screens/main/MenuScreen';
import TARTRACKHeader from '../components/TARTRACKHeader';
import * as Routes from '../constants/routes';

const Tab = createBottomTabNavigator();

export default function OwnerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === Routes.HOME) {
            return <Ionicons name="home-outline" size={size} color={color} />;
          } else if (route.name === Routes.EVENTS) {
            return <Ionicons name="star-outline" size={size} color={color} />;
          } else if (route.name === Routes.PROFILE) {
            return <Ionicons name="person-outline" size={size} color={color} />;
          }
        },
        tabBarActiveTintColor: '#6B2E2B',
        tabBarInactiveTintColor: '#aaa',
        tabBarShowLabel: true,
        headerShown: false,
      })}
    >
      <Tab.Screen
        name={Routes.HOME}
        component={OwnerHomeScreen}
        options={{ header: ({ navigation }) => <TARTRACKHeader onNotificationPress={() => navigation.navigate('Notification')} /> }}
      />
      <Tab.Screen
        name={Routes.EVENTS}
        component={OwnerBookScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name={Routes.PROFILE}
        component={MenuScreen}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
}


