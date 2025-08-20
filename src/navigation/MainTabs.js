import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import TouristHomeScreen from '../screens/main/TouristHomeScreen';
import TerminalsScreen from '../screens/map/TerminalsScreen';
import BookScreen from '../screens/main/BookScreen';
import MenuScreen from '../screens/main/MenuScreen';
import TARTRACKHeader from '../components/TARTRACKHeader';
import { useAuth } from '../hooks/useAuth';
import * as Routes from '../constants/routes';

const Tab = createBottomTabNavigator();

export default function MainTabs({ setRole }) {
  const navigation = useNavigation();
  const auth = useAuth();

  React.useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
    }
  }, [auth.loading, auth.isAuthenticated, navigation]);

  // Show loading or redirect if not authenticated
  if (auth.loading || !auth.isAuthenticated) {
    return null;
  }

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
          }
        },
        tabBarActiveTintColor: '#6B2E2B',
        tabBarInactiveTintColor: '#aaa',
        tabBarShowLabel: false,
        headerShown: false,
      })}
    >
      <Tab.Screen name={Routes.HOME} component={TouristHomeScreen} options={{ header: ({ navigation }) => <TARTRACKHeader onNotificationPress={() => navigation.navigate('NotificationScreen')} /> }} />
      <Tab.Screen name={Routes.TERMINALS} component={TerminalsScreen} options={{ header: ({ navigation }) => <TARTRACKHeader onNotificationPress={() => navigation.navigate('NotificationScreen')} /> }} />
      <Tab.Screen name={Routes.BOOK} component={BookScreen} options={{ header: ({ navigation }) => <TARTRACKHeader onNotificationPress={() => navigation.navigate('NotificationScreen')} /> }} />
      <Tab.Screen name={Routes.PROFILE} component={MenuScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
} 