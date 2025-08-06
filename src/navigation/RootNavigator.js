import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/splash/SplashScreen';
import WelcomeScreen from '../screens/welcome/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegistrationScreen from '../screens/auth/RegistrationScreen';
import MapViewScreen from '../screens/map/MapViewScreen';
import AccountDetailsScreen from '../screens/main/AccountDetailsScreen';
import NotificationScreen from '../screens/main/NotificationScreen';
import MainTabs from './MainTabs';
import DriverTabs from './DriverTabs';
import * as Routes from '../constants/routes';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const [role, setRole] = React.useState(null); // null, 'tourist', or 'driver'

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.SPLASH} component={SplashScreen} />
      <Stack.Screen name={Routes.WELCOME} component={WelcomeScreen} />
      <Stack.Screen name={Routes.MAP_VIEW} component={MapViewScreen} />
      <Stack.Screen name={Routes.LOGIN}>
        {props => <LoginScreen {...props} setRole={setRole} />}
      </Stack.Screen>
      <Stack.Screen name={Routes.REGISTRATION} component={RegistrationScreen} />
      <Stack.Screen name={Routes.MAIN}>
        {() => (role === 'driver' ? <DriverTabs /> : <MainTabs />)}
      </Stack.Screen>
      <Stack.Screen name={Routes.ACCOUNT_DETAILS} component={AccountDetailsScreen} />
      <Stack.Screen name={Routes.NOTIFICATION} component={NotificationScreen} />
    </Stack.Navigator>
  );
} 