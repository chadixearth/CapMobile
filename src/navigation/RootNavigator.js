import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { setNavigationRef } from '../services/apiClient';
import SplashScreen from '../screens/splash/SplashScreen';
import WelcomeScreen from '../screens/welcome/WelcomeScreen';
import RoleSelectionScreen from '../screens/welcome/RoleSelectionScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegistrationScreen from '../screens/auth/RegistrationScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
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
import PackageDetailsScreen from '../screens/main/PackageDetailsScreen';
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
import BookingHistoryScreen from '../screens/main/BookingHistoryScreen';
import ReviewSubmissionScreen from '../screens/main/ReviewSubmissionScreen';

import DriverBreakevenScreen from '../screens/main/DriverBreakevenScreen';
import ForcePasswordChangeScreen from '../screens/auth/ForcePasswordChangeScreen';
import DriverRideTrackingScreen from '../screens/main/DriverRideTrackingScreen';
import DeviceVerificationScreen from '../screens/auth/DeviceVerificationScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isAuthenticated, role, loading } = useAuth();
  const navigationRef = React.useRef();
  const [activeRole, setActiveRole] = React.useState(null);

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
  }, [isAuthenticated, role, activeRole, loading]);

  React.useEffect(() => {
    console.log('[RootNavigator] State changed:', { isAuthenticated, role, activeRole, loading });
  }, [isAuthenticated, role, activeRole, loading]);

  // Initialize activeRole when user logs in and reset on logout
  React.useEffect(() => {
    if (isAuthenticated && role) {
      const defaultRole = role === 'driver-owner' ? 'driver' : role;
      if (!activeRole || activeRole !== defaultRole) {
        console.log('[RootNavigator] Setting active role:', defaultRole);
        setActiveRole(defaultRole);
      }
      global.switchActiveRole = setActiveRole;
    } else if (!isAuthenticated) {
      // Reset activeRole when user logs out
      if (activeRole !== null) {
        console.log('[RootNavigator] Clearing active role');
        setActiveRole(null);
      }
      global.switchActiveRole = null;
    }
  }, [isAuthenticated, role]);

  // Reset navigation when role changes or user logs in
  React.useEffect(() => {
    if (isAuthenticated && activeRole && navigationRef.current?.isReady()) {
      console.log('[RootNavigator] Resetting navigation for role:', activeRole);
      // Use setTimeout to ensure state has fully propagated
      setTimeout(() => {
        if (navigationRef.current?.isReady()) {
          navigationRef.current.reset({
            index: 0,
            routes: [{ name: Routes.MAIN }],
          });
        }
      }, 100);
    }
  }, [isAuthenticated, activeRole]);

  if (loading || (isAuthenticated && !activeRole)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6B2E2B" />
      </View>
    );
  }

  const displayRole = activeRole || role;

  return (
    <>
      {isAuthenticated && <NotificationManager navigation={navigationRef.current} />}
      
      <Stack.Navigator ref={navigationRef} screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name={Routes.WELCOME} component={WelcomeScreen} />
          <Stack.Screen name={Routes.LOGIN} component={LoginScreen} />
          <Stack.Screen name={Routes.REGISTRATION} component={RegistrationScreen} />
          <Stack.Screen name={Routes.FORGOT_PASSWORD} component={ForgotPasswordScreen} />
          <Stack.Screen name={Routes.FORCE_PASSWORD_CHANGE} component={ForcePasswordChangeScreen} />
          <Stack.Screen name="DeviceVerification" component={DeviceVerificationScreen} />
          <Stack.Screen name={Routes.ROLE_SELECTION} component={RoleSelectionScreen} />
          <Stack.Screen name={Routes.MAP_VIEW} component={MapViewScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name={Routes.MAIN}>
            {props => {
              if (displayRole === 'driver') return <DriverTabs {...props} />;
              if (displayRole === 'owner') return <OwnerTabs {...props} />;
              return <MainTabs {...props} />;
            }}
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
          <Stack.Screen name="PackageDetails" component={PackageDetailsScreen} />
          <Stack.Screen name="MyCarriages" component={MyCarriagesScreen} />
          <Stack.Screen name="CompletionPhoto" component={CompletionPhotoScreen} />
          <Stack.Screen name="CompletionPhotoScreen" component={CompletionPhotoScreen} />
          <Stack.Screen name="PaymentReceipt" component={PaymentReceiptScreen} />
          <Stack.Screen name="DriverSchedule" component={DriverScheduleScreen} />
          <Stack.Screen name="SetAvailability" component={SetAvailabilityScreen} />
          <Stack.Screen name="DriverCarriageAssignments" component={DriverCarriageAssignmentsScreen} />
          <Stack.Screen name="Chat" component={ChatNavigator} />
          <Stack.Screen name="Communication" component={Communication} />
          <Stack.Screen name={Routes.TOURIST_REFUND} component={TouristRefundScreen} />
          <Stack.Screen name="BookingHistory" component={BookingHistoryScreen} />
          <Stack.Screen name="ReviewSubmission" component={ReviewSubmissionScreen} />
          <Stack.Screen name={Routes.BREAKEVEN} component={DriverBreakevenScreen} />
          <Stack.Screen name="DriverRideTracking" component={DriverRideTrackingScreen} />
        </>
      )}
      </Stack.Navigator>
    </>
  );
}
