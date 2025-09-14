import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import BackButton from '../../components/BackButton';
import * as Routes from '../../constants/routes';

const WelcomeScreen = ({ navigation }) => {
  const handleViewMap = () => {
    navigation.navigate(Routes.MAP_VIEW);
  };
  const handleGetStarted = () => {
    navigation.navigate(Routes.REGISTRATION);
  };
  const handleLogin = () => {
    console.log('[WelcomeScreen] Navigating to Login');
    navigation.navigate(Routes.LOGIN);
  };
  const handleRoleSelect = (role) => {
    navigation.navigate(Routes.REGISTRATION, { role });
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.welcomeText}>Welcome</Text>

        {/* Replace text logo with image logo */}
        <Image
          source={require('../../../assets/TarTrack Logo_sakto.png')} 
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.subtitle}>Cebu Tartanilla Online{"\n"}Booking</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleViewMap}>
          <Text style={styles.buttonText}>View Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => handleRoleSelect('tourist')}>
          <Text style={styles.buttonText}>Get Started as Tourist</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => handleRoleSelect('driver')}>
          <Text style={styles.buttonText}>Get Started as Driver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => handleRoleSelect('owner')}>
          <Text style={styles.buttonText}>Get Started as Owner</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.linksContainer}>
        <Text style={styles.linkText}>
          Already have an account?{' '}
          <Text style={styles.link} onPress={handleLogin}>Login</Text>
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  welcomeText: {
    fontSize: 28,
    fontStyle: 'italic',
    marginBottom: 0,
    letterSpacing: 4,
  },
  logo: {
    width: 250,   // adjust as needed
    height: 80,   // adjust as needed
    marginBottom: 0,
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#333',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 0,
    letterSpacing:4,
    
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#7B3F3F',
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 60,
    marginVertical: 8,
    width: 300,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  linksContainer: {
    alignItems: 'center',
  },
  linkText: {
    fontSize: 15,
    color: '#222',
    marginVertical: 2,
  },
  link: {
    color: '#7B3F3F',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});

export default WelcomeScreen;
