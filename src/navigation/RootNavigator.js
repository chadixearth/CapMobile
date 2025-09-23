import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { setNavigationRef } from '../services/apiClient';
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
import CompletionPhotoScreen from '../screens/main/CompletionPhotoScreen';
import PaymentReceiptScreen from '../screens/main/PaymentReceiptScreen';
import DriverScheduleScreen from '../screens/main/DriverScheduleScreen';
import SetAvailabilityScreen from '../screens/main/SetAvailabilityScreen';
import DriverCarriageAssignmentsScreen from '../screens/main/DriverCarriageAssignmentsScreen';
import MyCarriagesScreen from '../screens/main/MyCarriagesScreen';
import MainTabs from './MainTabs';
import DriverTabs from './DriverTabs';
import OwnerTabs from './OwnerTabs';
import * as Routes from '../constants/routes';
import ChatNavigator from '../chat/navigation/ChatNavigator';
import Communication from '../communication/navigation/CommunicationNavigator';
import { useAuth } from '../hooks/useAuth';
import NotificationManager from '../components/NotificationManager';
import TouristRefundScreen from '../screens/main/TouristRefundScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isAuthenticated, role, loading } = useAuth();
  const navigationRef = React.useRef();

  React.useEffect(() => {
    if (navigationRef.current) {
      setNavigationRef(navigationRef.current);
      global.navigationRef = navigationRef.current;
    }
  }, []);

  React.useEffect(() => {
    if (navigationRef.current && navigationRef.current.isReady()) {
      global.navigationRef = navigationRef.current;
    }
  }, [isAuthenticated, role, loading]);

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
    <>
      {/* Global Notification Manager - works across all tabs */}
      {isAuthenticated && <NotificationManager navigation={navigationRef.current} />}
      
      <Stack.Navigator ref={navigationRef} screenOptions={{ headerShown: false }}>
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
          <Stack.Screen name="MyCarriages" component={MyCarriagesScreen} />
          <Stack.Screen name="CompletionPhoto" component={CompletionPhotoScreen} />
          <Stack.Screen name="PaymentReceipt" component={PaymentReceiptScreen} />
          <Stack.Screen name="DriverSchedule" component={DriverScheduleScreen} />
          <Stack.Screen name="SetAvailability" component={SetAvailabilityScreen} />
          <Stack.Screen name="DriverCarriageAssignments" component={DriverCarriageAssignmentsScreen} />
          <Stack.Screen name="Chat" component={ChatNavigator} />
          <Stack.Screen name="Communication" component={Communication} />
          <Stack.Screen name={Routes.TOURIST_REFUND} // 'TouristRefundScreen' per your routes.js
              component={TouristRefundScreen}
            />

        </>
      )}
      </Stack.Navigator>
    </>
  );
}