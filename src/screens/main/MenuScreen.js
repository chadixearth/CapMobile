// screens/main/MenuScreen.jsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import ProfileItem from '../../components/ProfileItem';
import * as Routes from '../../constants/routes';
import Button from '../../components/Button';
import { getCurrentUser, getUserProfile } from '../../services/authService';
import { supabase } from '../../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';

const MAROON = '#6B2E2B';
const BG = '#F8F8F8';
const CARD = '#FFFFFF';
const BORDER = '#EEE';
const MUTED = '#6F6F6F';

export default function MenuScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const auth = useAuth();

  const fetchUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        const profileResult = await getUserProfile(currentUser.id);
        let userData = currentUser;
        if (profileResult.success && profileResult.data) {
          userData = { ...currentUser, ...profileResult.data };
        }
        setUser(userData);
      } else {
        const { data } = await supabase.auth.getUser();
        if (data?.user) setUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setFetching(false);
  };

  useEffect(() => {
    fetchUser();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchUser();
    }, [])
  );

  const openLogoutConfirm = () => setLogoutVisible(true);
  const closeLogoutConfirm = () => {
    if (!loggingOut) setLogoutVisible(false);
  };

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await auth.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setLoggingOut(false);
      setLogoutVisible(false);
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  };

  const name =
    user?.name || user?.full_name || user?.user_metadata?.name || '';
  const email = user?.email || '';
  const avatarUrl = name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
        name
      )}&background=6B2E2B&color=fff&size=128`
    : 'https://ui-avatars.com/api/?name=User&background=6B2E2B&color=fff&size=128';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Top icons row */}
        <View style={styles.headerIconsRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack?.()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate(Routes.NOTIFICATIONS || 'NotificationScreen')
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.avatarRow}>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          <View style={styles.userInfo}>
            <Text style={styles.name} numberOfLines={1}>
              {name || 'Set your account details'}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {email || ' '}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.sections}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Activity */}
        <Text style={styles.sectionTitle}>Activity</Text>
        <View style={styles.card}>
          <ProfileItem
            icon={<Ionicons name="person-outline" size={22} color={MAROON} />}
            label="Account Details"
            onPress={() => navigation.navigate(Routes.ACCOUNT_DETAILS)}
          />
          <Divider />
          <ProfileItem
            icon={<Ionicons name="star-outline" size={22} color={MAROON} />}
            label="Reviews"
            onPress={() => navigation.navigate(Routes.REVIEWS || 'Reviews')}
          />
        </View>

        {/* Support */}
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.card}>
          <ProfileItem
            icon={
              <Ionicons
                name="information-circle-outline"
                size={22}
                color={MAROON}
              />
            }
            label="About TarTrack"
            onPress={() => navigation.navigate(Routes.ABOUT || 'About')}
          />
          <Divider />
          <ProfileItem
            icon={
              <Ionicons name="help-circle-outline" size={22} color={MAROON} />
            }
            label="Help Center"
            onPress={() => navigation.navigate(Routes.HELP || 'Help')}
          />
        </View>

        {/* Legal */}
        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.card}>
          <ProfileItem
            icon={<MaterialIcons name="gavel" size={22} color={MAROON} />}
            label="General terms and conditions"
            onPress={() => navigation.navigate(Routes.TERMS || 'Terms')}
          />
          <Divider />
          <ProfileItem
            icon={
              <MaterialIcons name="privacy-tip" size={22} color={MAROON} />
            }
            label="Privacy Policy"
            onPress={() => navigation.navigate(Routes.PRIVACY || 'Privacy')}
          />
        </View>

        <Text style={styles.versionText}>TarTrack v1.0.0</Text>
      </ScrollView>

      {/* Log Out Button */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Button
          title={
            <>
              <Ionicons
                name="log-out-outline"
                size={20}
                color="#fff"
                style={{ marginRight: 8 }}
              />{' '}
              Log Out
            </>
          }
          onPress={openLogoutConfirm}
          textStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </View>

      {/* Logout Modal */}
      <Modal
        visible={logoutVisible}
        transparent
        animationType="fade"
        onRequestClose={closeLogoutConfirm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={30} color={MAROON} />
            </View>

            
            <Text style={styles.modalDesc}>
              You will be signed out of your account. You’ll need to log in
              again to continue.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={closeLogoutConfirm}
                disabled={loggingOut}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalPrimary,
                  loggingOut && { opacity: 0.7 },
                ]}
                onPress={doLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    {/* <Ionicons
                      name="exit-outline"
                      size={16}
                      color="#fff"
                      style={{ marginRight: 6 }}
                    /> */}
                    <Text style={styles.modalPrimaryText}>Log out</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* Divider helper */
function Divider() {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: BORDER,
        marginLeft: 56,
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    backgroundColor: MAROON,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: { flex: 1 },
  name: { color: '#fff', fontSize: 18, fontWeight: '800' },
  email: { color: '#f3e6e6', fontSize: 13, marginTop: 2 },

  sections: { flex: 1, marginTop: 12 },

  sectionTitle: {
    color: '#8A8A8A',
    fontSize: 13,
    marginLeft: 20,
    marginTop: 16,
    marginBottom: 6,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 1,
    borderColor: '#F0E7E3',
  },

  versionText: {
    textAlign: 'center',
    color: '#9A9A9A',
    fontSize: 12,
    marginTop: 10,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  modalIconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5EAEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  modalDesc: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  modalCancel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  modalCancelText: {
    color: '#444',
    fontWeight: '700',
  },
  modalPrimary: {
    backgroundColor: MAROON,
  },
  modalPrimaryText: {
    color: '#fff',
    fontWeight: '700',
  },
});
