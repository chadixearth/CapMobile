import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Routes from '../../constants/routes';

const MAROON = '#6B2E2B';
const BG = '#F5F5F5';

export default function RoleSelectorScreen({ navigation, route }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = async (role) => {
    setSelectedRole(role);
    setLoading(true);

    try {
      if (global.switchActiveRole) {
        global.switchActiveRole(role);
      }
      
      // Navigate to main app
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: Routes.MAIN }],
        });
      }, 300);
    } catch (error) {
      console.error('Error selecting role:', error);
      setLoading(false);
      setSelectedRole(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require('../../../assets/TarTrack Logo_sakto.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Choose Your Role</Text>
        <Text style={styles.subtitle}>
          Select how you'd like to use TarTrack today
        </Text>

        {/* Role Cards */}
        <View style={styles.rolesContainer}>
          {/* Driver Role */}
          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'driver' && styles.roleCardSelected,
              loading && { opacity: 0.6 },
            ]}
            onPress={() => !loading && handleRoleSelect('driver')}
            disabled={loading}
            activeOpacity={0.85}
          >
            <View style={styles.roleIconContainer}>
              <MaterialIcons name="directions-car" size={40} color={MAROON} />
            </View>
            <Text style={styles.roleTitle}>Driver</Text>
            <Text style={styles.roleDescription}>
              Accept rides and manage your schedule
            </Text>
            {selectedRole === 'driver' && !loading && (
              <View style={styles.checkmark}>
                <Ionicons name="checkmark-circle" size={24} color={MAROON} />
              </View>
            )}
            {selectedRole === 'driver' && loading && (
              <View style={styles.checkmark}>
                <ActivityIndicator size="small" color={MAROON} />
              </View>
            )}
          </TouchableOpacity>

          {/* Owner Role */}
          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'owner' && styles.roleCardSelected,
              loading && { opacity: 0.6 },
            ]}
            onPress={() => !loading && handleRoleSelect('owner')}
            disabled={loading}
            activeOpacity={0.85}
          >
            <View style={styles.roleIconContainer}>
              <MaterialIcons name="business" size={40} color={MAROON} />
            </View>
            <Text style={styles.roleTitle}>Owner</Text>
            <Text style={styles.roleDescription}>
              Manage your carriages and bookings
            </Text>
            {selectedRole === 'owner' && !loading && (
              <View style={styles.checkmark}>
                <Ionicons name="checkmark-circle" size={24} color={MAROON} />
              </View>
            )}
            {selectedRole === 'owner' && loading && (
              <View style={styles.checkmark}>
                <ActivityIndicator size="small" color={MAROON} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          You can switch roles anytime from the menu
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    paddingTop: 40,
    paddingBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F1F1F',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6F6F6F',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  rolesContainer: {
    gap: 16,
    marginBottom: 32,
  },
  roleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E8DCD8',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  roleCardSelected: {
    borderColor: MAROON,
    backgroundColor: '#FBF8F7',
  },
  roleIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F5EAEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  roleDescription: {
    fontSize: 13,
    color: '#6F6F6F',
    textAlign: 'center',
    lineHeight: 18,
  },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  hint: {
    fontSize: 12,
    color: '#9A9A9A',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
