import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DriverHomeScreen from '../screens/main/DriverHomeScreen';
import EarningsScreen from '../screens/main/EarningsScreen';
import MenuScreen from '../screens/main/MenuScreen';
import DriverBookScreen from '../screens/main/DriverBookScreen';
import DriverScheduleScreen from '../screens/main/DriverScheduleScreen';
import TARTRACKHeader from '../components/TARTRACKHeader';
import GoodsServicesScreen from '../screens/main/GoodsServicesScreen';
import { useAuth } from '../hooks/useAuth';
import * as Routes from '../constants/routes';

const Tab = createBottomTabNavigator();

export default function DriverTabs({ setRole }) {
  const navigation = useNavigation();
  const auth = useAuth();

  // Authentication and role state transitions are handled by RootNavigator

  // Show loading or redirect if not authenticated or wrong role
  if (auth.loading || !auth.isAuthenticated || auth.role !== 'driver') {
    return null;
  }

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
          } else if (route.name === Routes.GOODS_SERVICES) {
            return <Ionicons name="pricetags-outline" size={size} color={color} />;
          } else if (route.name === 'Menu') {
            return <Ionicons name="settings-outline" size={size} color={color} />;
          }
        },
        tabBarActiveTintColor: '#6B2E2B',
        tabBarInactiveTintColor: '#aaa',
        tabBarShowLabel: false,
        headerShown: true,
      })}
    >
      <Tab.Screen name={Routes.HOME} component={DriverHomeScreen} options={{ header: ({ navigation }) => <TARTRACKHeader onNotificationPress={() => navigation.navigate(Routes.NOTIFICATION)} /> }} />
      <Tab.Screen name={Routes.EARNINGS} component={EarningsScreen} options={{ header: ({ navigation }) => <TARTRACKHeader onNotificationPress={() => navigation.navigate(Routes.NOTIFICATION)} /> }} />
      <Tab.Screen name={Routes.BOOKINGS} component={DriverBookScreen} options={{ header: ({ navigation }) => <TARTRACKHeader onNotificationPress={() => navigation.navigate(Routes.NOTIFICATION)} /> }} />
      <Tab.Screen name="Schedule" component={DriverScheduleScreen} options={{ 
        header: ({ navigation }) => <TARTRACKHeader onNotificationPress={() => navigation.navigate(Routes.NOTIFICATION)} />,
        tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />
      }} />
      <Tab.Screen name={Routes.MENU} component={MenuScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
} 