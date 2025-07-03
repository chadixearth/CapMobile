import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import RegistrationScreen from './screens/RegistrationScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import { TouchableOpacity, Text } from 'react-native';

const Stack = createStackNavigator();

function RootNavigator() {
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={({ navigation }) => ({
          headerShown: true,
          title: '',
          headerBackTitleVisible: false,
          headerLeft: () => (
            <TouchableOpacity style={{ marginLeft: 15 }} onPress={() => navigation.navigate('Welcome')}>
              <Text style={{ fontSize: 18 }}>Back</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen 
        name="Registration" 
        component={RegistrationScreen} 
        options={({ navigation }) => ({
          headerShown: true,
          title: '',
          headerBackTitleVisible: false,
          headerLeft: () => (
            <TouchableOpacity style={{ marginLeft: 15 }} onPress={() => navigation.navigate('Welcome')}>
              <Text style={{ fontSize: 18 }}>Back</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}
