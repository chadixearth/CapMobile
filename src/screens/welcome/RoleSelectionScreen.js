import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BackButton from '../../components/BackButton';
import * as Routes from '../../constants/routes';

const RoleSelectionScreen = ({ navigation }) => {
  const handleRoleSelect = (role) => {
    navigation.navigate(Routes.REGISTRATION, { role });
  };

  const handleLogin = () => {
    navigation.navigate(Routes.LOGIN);
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/TarTrack Logo_sakto.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Business Registration</Text>
          <Text style={styles.subtitle}>Choose your role to get started</Text>
        </View>

        <View style={styles.roleContainer}>
          <TouchableOpacity 
            style={styles.roleCard} 
            onPress={() => handleRoleSelect('driver')}
            activeOpacity={0.8}
          >
            <View style={styles.roleIcon}>
              <Ionicons name="car" size={32} color="#6B2E2B" />
            </View>
            <Text style={styles.roleTitle}>Driver</Text>
            <Text style={styles.roleDescription}>
              Drive tartanilla, offer tour packages, and earn income
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.roleCard} 
            onPress={() => handleRoleSelect('owner')}
            activeOpacity={0.8}
          >
            <View style={styles.roleIcon}>
              <Ionicons name="business" size={32} color="#6B2E2B" />
            </View>
            <Text style={styles.roleTitle}>Owner</Text>
            <Text style={styles.roleDescription}>
              Manage tartanilla fleet, drivers, and business operations
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.linksContainer}>
          <Text style={styles.linkText}>
            Already have a business account?{' '}
            <Text style={styles.link} onPress={handleLogin}>Login</Text>
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  topBar: {
    paddingTop: 50,
    paddingLeft: 20,
    paddingBottom: 10,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 200,
    height: 60,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  roleContainer: {
    width: '100%',
    marginBottom: 40,
  },
  roleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  roleIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f5f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  roleDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  linksContainer: {
    alignItems: 'center',
  },
  linkText: {
    fontSize: 15,
    color: '#222',
  },
  link: {
    color: '#6B2E2B',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});

export default RoleSelectionScreen;