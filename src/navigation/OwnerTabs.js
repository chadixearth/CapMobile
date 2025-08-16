import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import OwnerHomeScreen from '../screens/main/OwnerHomeScreen';
import MenuScreen from '../screens/main/MenuScreen';
import TARTRACKHeader from '../components/TARTRACKHeader';
import * as Routes from '../constants/routes';

const Tab = createBottomTabNavigator();

export default function OwnerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') {
            return <Ionicons name="home-outline" size={size} color={color} />;
          } else if (route.name === 'Profile') {
            return <Ionicons name="person-outline" size={size} color={color} />;
          }
        },
        tabBarActiveTintColor: '#6B2E2B',
        tabBarInactiveTintColor: '#aaa',
        tabBarShowLabel: false,
        headerShown: false,
      })}
    >
      <Tab.Screen
        name={Routes.HOME}
        component={OwnerHomeScreen}
        options={{ header: ({ navigation }) => <TARTRACKHeader onNotificationPress={() => navigation.navigate('Notification')} /> }}
      />
      <Tab.Screen
        name={Routes.PROFILE}
        component={MenuScreen}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
}


