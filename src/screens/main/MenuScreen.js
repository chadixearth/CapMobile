import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import ProfileItem from '../../components/ProfileItem';
import * as Routes from '../../constants/routes';
import Button from '../../components/Button';
import { getCurrentUser, getUserProfile } from '../../services/authService';
import { supabase } from '../../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';

export default function MenuScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = useAuth();

  const fetchUser = async () => {
    try {
      // Try to get current user from new auth system
      const currentUser = await getCurrentUser();
      if (currentUser) {
        // Try to get detailed profile from API
        const profileResult = await getUserProfile(currentUser.id);
        
        let userData = currentUser;
        if (profileResult.success && profileResult.data) {
          userData = { ...currentUser, ...profileResult.data };
        }
        
        setUser(userData);
      } else {
        // Fallback to Supabase for existing users
        const { data, error } = await supabase.auth.getUser();
        if (data?.user) {
          setUser(data.user);
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUser();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchUser();
    }, [])
  );

  const handleLogout = async () => {
    try {
      // Use the auth hook logout function
      await auth.logout();
      
      // Reset navigation stack completely to prevent back navigation
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, navigate to welcome screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
    }
  };

  // Handle both new auth system and Supabase user data formats
  const name = user?.name || user?.full_name || user?.user_metadata?.name || '';
  const email = user?.email || '';
  const avatarUrl = name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6B2E2B&color=fff&size=128`
    : 'https://ui-avatars.com/api/?name=User&background=6B2E2B&color=fff&size=128';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.name}>{name || 'Set your account details'}</Text>
            <Text style={styles.email}>{email}</Text>
          </View>
        </View>
        <Ionicons name="notifications-outline" size={24} color="#fff" style={styles.notifIcon} />
      </View>

      <ScrollView style={styles.sections} showsVerticalScrollIndicator={false}>
        {/* Activity Section */}
        <Text style={styles.sectionTitle}>Activity</Text>
        <View style={styles.sectionBox}>
          <ProfileItem icon={<Ionicons name="person-outline" size={22} color="#6B2E2B" />} label="Account Details" onPress={() => navigation.navigate(Routes.ACCOUNT_DETAILS)} />
          <ProfileItem icon={<Ionicons name="star-outline" size={22} color="#6B2E2B" />} label="Reviews" />
        </View>

        {/* Support Section */}
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.sectionBox}>
          <ProfileItem icon={<Ionicons name="information-circle-outline" size={22} color="#6B2E2B" />} label="About TarTrack" />
          <ProfileItem icon={<Ionicons name="help-circle-outline" size={22} color="#6B2E2B" />} label="Help Center" />
        </View>

        {/* Legal Section */}
        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.sectionBox}>
          <ProfileItem icon={<MaterialIcons name="gavel" size={22} color="#6B2E2B" />} label="General terms and conditions" />
          <ProfileItem icon={<MaterialIcons name="privacy-tip" size={22} color="#6B2E2B" />} label="Privacy Policy" />
        </View>
      </ScrollView>

      {/* Log Out Button */}
      <Button
        title={<><Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} /> Log Out</>}
        onPress={handleLogout}
        textStyle={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  header: {
    backgroundColor: '#6B2E2B',
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  avatarContainer: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, marginRight: 16, borderWidth: 2, borderColor: '#fff' },
  userInfo: {},
  name: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  email: { color: '#f3e6e6', fontSize: 13, marginTop: 2 },
  notifIcon: { marginLeft: 8 },
  sections: { flex: 1, marginTop: 12 },
  sectionTitle: { color: '#888', fontSize: 13, marginLeft: 24, marginTop: 18, marginBottom: 2, fontWeight: '600' },
  sectionBox: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, marginBottom: 8, paddingVertical: 2, elevation: 1 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0eeee',
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  itemLabel: { marginLeft: 16, fontSize: 15, color: '#222' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B2E2B',
    margin: 18,
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
