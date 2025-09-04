import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import SplashScreen from '../screens/splash/SplashScreen';
import WelcomeScreen from '../screens/welcome/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegistrationScreen from '../screens/auth/RegistrationScreen';
import MapViewScreen from '../screens/map/MapViewScreen';
import AccountDetailsScreen from '../screens/main/AccountDetailsScreen';
import TartanillaCarriagesScreen from '../screens/main/TartanillaCarriagesScreen';
import NotificationScreen from '../screens/main/NotificationScreen';
import RequestBookingScreen from '../screens/main/requestBookingScreen';
import CustomPackageRequestScreen from '../screens/main/CustomPackageRequestScreen';
import CustomRequestHistoryScreen from '../screens/main/CustomRequestHistoryScreen';
import DriverEarningsScreen from '../screens/main/DriverEarningsScreen';
import PaymentScreen from '../screens/main/PaymentScreen';
import BookingConfirmationScreen from '../screens/main/BookingConfirmationScreen';
import ReviewsScreen from '../screens/main/ReviewsScreen';
import MyTourPackagesScreen from '../screens/main/MyTourPackagesScreen';
import CreateTourPackageScreen from '../screens/main/CreateTourPackageScreen';
import MainTabs from './MainTabs';
import DriverTabs from './DriverTabs';
import OwnerTabs from './OwnerTabs';
import * as Routes from '../constants/routes';
import ChatNavigator from '../chat/navigation/ChatNavigator';
import { useAuth } from '../hooks/useAuth';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isAuthenticated, role, loading } = useAuth();

  React.useEffect(() => {
    console.log('[RootNavigator] State changed:', { isAuthenticated, role, loading });
  }, [isAuthenticated, role, loading]);

  console.log('[RootNavigator] Current render state:', { isAuthenticated, role, loading });

  // Force re-render when auth state changes
  React.useEffect(() => {
    if (!loading) {
      console.log('[RootNavigator] Auth state settled:', { isAuthenticated, role });
    }
  }, [isAuthenticated, role, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6B2E2B" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name={Routes.WELCOME} component={WelcomeScreen} />
          <Stack.Screen name={Routes.LOGIN} component={LoginScreen} />
          <Stack.Screen name={Routes.REGISTRATION} component={RegistrationScreen} />
          <Stack.Screen name={Routes.MAP_VIEW} component={MapViewScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name={Routes.MAIN}>
            {props => (role === 'driver' ? <DriverTabs {...props} /> : role === 'owner' ? <OwnerTabs {...props} /> : <MainTabs {...props} />)}
          </Stack.Screen>
          <Stack.Screen name={Routes.MAP_VIEW} component={MapViewScreen} />
          <Stack.Screen name={Routes.ACCOUNT_DETAILS} component={AccountDetailsScreen} />
          <Stack.Screen name={Routes.TARTANILLA_CARRIAGES} component={TartanillaCarriagesScreen} />
          <Stack.Screen name={Routes.NOTIFICATION} component={NotificationScreen} />
          <Stack.Screen name={Routes.REQUEST_BOOKING} component={RequestBookingScreen} />
          <Stack.Screen name={Routes.CUSTOM_PACKAGE_REQUEST} component={CustomPackageRequestScreen} />
          <Stack.Screen name={Routes.CUSTOM_REQUEST_HISTORY} component={CustomRequestHistoryScreen} />
          <Stack.Screen name={Routes.DRIVER_EARNINGS} component={DriverEarningsScreen} />
          <Stack.Screen name={Routes.PAYMENT} component={PaymentScreen} />
          <Stack.Screen name={Routes.BOOKING_CONFIRMATION} component={BookingConfirmationScreen} />
          <Stack.Screen name={Routes.REVIEWS} component={ReviewsScreen} />
          <Stack.Screen name="MyTourPackages" component={MyTourPackagesScreen} />
          <Stack.Screen name="CreateTourPackage" component={CreateTourPackageScreen} />
          <Stack.Screen name="EditTourPackage" component={CreateTourPackageScreen} />
          <Stack.Screen name="Chat" component={ChatNavigator} />
        </>
      )}
    </Stack.Navigator>
  );
}