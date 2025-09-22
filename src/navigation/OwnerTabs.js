import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import OwnerHomeScreen from '../screens/main/OwnerHomeScreen';
import OwnerBookScreen from '../screens/main/OwnerBookScreen';
import OwnerBreakevenScreen from '../screens/main/OwnerBreakevenScreen';
import MenuScreen from '../screens/main/MenuScreen';
import TARTRACKHeader from '../components/TARTRACKHeader';
import GoodsServicesScreen from '../screens/main/GoodsServicesScreen';
import { useAuth } from '../hooks/useAuth';
import * as Routes from '../constants/routes';

const Tab = createBottomTabNavigator();

export default function OwnerTabs({ setRole }) {
  const navigation = useNavigation();
  const auth = useAuth();

  // Authentication and role state transitions are handled by RootNavigator

  // Show loading or redirect if not authenticated or wrong role
  if (auth.loading || !auth.isAuthenticated || auth.role !== 'owner') {
    return null;
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === Routes.HOME) {
            return <Ionicons name="home-outline" size={size} color={color} />;
          } else if (route.name === Routes.BREAKEVEN) {
            return <Ionicons name="wallet-outline" size={size} color={color} />;
          } else if (route.name === Routes.EVENTS) {
            return <Ionicons name="star-outline" size={size} color={color} />;
          } else if (route.name === Routes.PROFILE) {
            return <Ionicons name="person-outline" size={size} color={color} />;
          } else if (route.name === Routes.GOODS_SERVICES) {
            return <Ionicons name="pricetags-outline" size={size} color={color} />;
          }
        },
        tabBarActiveTintColor: '#6B2E2B',
        tabBarInactiveTintColor: '#aaa',
        tabBarShowLabel: true,
        headerShown: true,
      })}
    >
      <Tab.Screen
        name={Routes.HOME}
        component={OwnerHomeScreen}
        options={{ header: ({ navigation }) => <TARTRACKHeader onNotificationPress={() => navigation.navigate(Routes.NOTIFICATION)} /> }}
      />
      <Tab.Screen 
        name={Routes.BREAKEVEN} 
        component={OwnerBreakevenScreen} 
        options={{ header: ({ navigation }) => <TARTRACKHeader onNotificationPress={() => navigation.navigate(Routes.NOTIFICATION)} /> }} />
      
      <Tab.Screen
        name={Routes.EVENTS}
        component={OwnerBookScreen}
        options={{ header: ({ navigation }) => <TARTRACKHeader onNotificationPress={() => navigation.navigate(Routes.NOTIFICATION)} /> }}
      />
      <Tab.Screen
        name={Routes.GOODS_SERVICES}
        component={GoodsServicesScreen}
        options={{ header: ({ navigation }) => <TARTRACKHeader onNotificationPress={() => navigation.navigate(Routes.NOTIFICATION)} /> }}
      />
      <Tab.Screen
        name={Routes.PROFILE}
        component={MenuScreen}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
}


