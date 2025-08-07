import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import DriverHomeScreen from '../screens/main/DriverHomeScreen';
import EarningsScreen from '../screens/main/EarningsScreen';
import MenuScreen from '../screens/main/MenuScreen';
import DriverBookScreen from '../screens/main/DriverBookScreen';
import TARTRACKHeader from '../components/TARTRACKHeader';
import * as Routes from '../constants/routes';

const Tab = createBottomTabNavigator();

export default function DriverTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') {
            return <Ionicons name="home-outline" size={size} color={color} />;
          } else if (route.name === 'Earnings') {
            return <Ionicons name="wallet-outline" size={size} color={color} />;
          } else if (route.name === 'Bookings') {
            return <Ionicons name="list-outline" size={size} color={color} />;
          } else if (route.name === 'Menu') {
            return <Ionicons name="settings-outline" size={size} color={color} />;
          }
        },
        tabBarActiveTintColor: '#6B2E2B',
        tabBarInactiveTintColor: '#aaa',
        tabBarShowLabel: false,
        headerShown: false,
      })}
    >
      <Tab.Screen name={Routes.HOME} component={DriverHomeScreen} options={{ header: () => <TARTRACKHeader /> }} />
      <Tab.Screen name={Routes.EARNINGS} component={EarningsScreen} options={{ header: () => <TARTRACKHeader /> }} />
      <Tab.Screen name={Routes.BOOKINGS} component={DriverBookScreen} options={{ header: () => <TARTRACKHeader /> }} />
      <Tab.Screen name={Routes.MENU} component={MenuScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
} 