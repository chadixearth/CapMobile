import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import BackButton from '../../components/BackButton';
import * as Routes from '../../constants/routes';

const WelcomeScreen = ({ navigation }) => {
  // Placeholder handlers for navigation
  const handleViewMap = () => {
    navigation.navigate(Routes.MAP_VIEW);
  };
  const handleGetStarted = () => {
    navigation.navigate(Routes.REGISTRATION);
  };
  const handleLogin = () => {
    navigation.navigate(Routes.LOGIN);
  };
  const handleRoleSelect = (role) => {
    navigation.navigate(Routes.REGISTRATION, { role });
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.welcomeText}>Welcome</Text>
        {/* Replace with your logo image if available */}
        <Text style={styles.logoText}>TARTRACK</Text>
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
          Have an account?{' '}
          <Text style={styles.link} onPress={handleLogin}>login</Text>
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
    marginBottom: 10,
    letterSpacing: 2,
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#7B3F3F',
    letterSpacing: 2,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 5,
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
  },
});

export default WelcomeScreen;
