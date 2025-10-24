import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import TouristHomeScreen from '../screens/main/TouristHomeScreen';
import TerminalsScreen from '../screens/map/TerminalsScreen';
import BookScreen from '../screens/main/BookScreen';
import MenuScreen from '../screens/main/MenuScreen';
import TARTRACKHeader from '../components/TARTRACKHeader';
import GoodsServicesScreen from '../screens/main/GoodsServicesScreen';
import * as Routes from '../constants/routes';

const Tab = createBottomTabNavigator();

export default function MainTabs() {

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') {
            return <Ionicons name="home-outline" size={size} color={color} />;
          } else if (route.name === 'Terminals') {
            return <Ionicons name="location-outline" size={size} color={color} />;
          } else if (route.name === 'Book') {
            return <Ionicons name="book-outline" size={size} color={color} />;
          } else if (route.name === 'Profile') {
            return <Ionicons name="person-outline" size={size} color={color} />;
          } else if (route.name === Routes.GOODS_SERVICES) {
            return <Ionicons name="pricetags-outline" size={size} color={color} />;
          }
        },
        tabBarActiveTintColor: '#6B2E2B',
        tabBarInactiveTintColor: '#aaa',
        tabBarShowLabel: false,
        headerShown: true,
      })}
    >
      <Tab.Screen name={Routes.HOME} component={TouristHomeScreen} options={{ header: () => <TARTRACKHeader /> }} />
      <Tab.Screen name={Routes.TERMINALS} component={TerminalsScreen} options={{ header: () => <TARTRACKHeader /> }} />
      <Tab.Screen name={Routes.BOOK} component={BookScreen} options={{ header: () => <TARTRACKHeader /> }} />
      <Tab.Screen name={Routes.GOODS_SERVICES} component={GoodsServicesScreen} options={{ header: () => <TARTRACKHeader /> }} />
      <Tab.Screen name={Routes.PROFILE} component={MenuScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
} 