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
  Alert,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import ProfileItem from '../../components/ProfileItem';
import * as Routes from '../../constants/routes';
import Button from '../../components/Button';
import HelpCenter from '../../components/HelpCenter';
import TermsModal from '../../components/TermsModal';
import PrivacyModal from '../../components/PrivacyModal';
import { getCurrentUser, getUserProfile } from '../../services/authService';
import { supabase } from '../../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { requestAccountDeletion } from '../../services/accountDeletionService';
import { useAuthData } from '../../hooks/useAuthData';

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
  const [deleteAccountVisible, setDeleteAccountVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [roleSwitchVisible, setRoleSwitchVisible] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [currentRole, setCurrentRole] = useState(null);
  const auth = useAuth();
  const { bookings, userCarriages, hasData } = useAuthData();

  const fetchUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        const profileResult = await getUserProfile(currentUser.id);
        let userData = currentUser;
        if (profileResult.success && profileResult.data) {
          userData = { ...currentUser, ...profileResult.data };
          if (
            profileResult.data.first_name ||
            profileResult.data.middle_name ||
            profileResult.data.last_name
          ) {
            const fullName = [
              profileResult.data.first_name,
              profileResult.data.middle_name,
              profileResult.data.last_name,
            ]
              .filter(Boolean)
              .join(' ');
            userData.name = fullName;
            userData.full_name = fullName;
          }
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
    setCurrentRole(auth.user?.role);
  }, [auth.user?.role]);

  useFocusEffect(
    React.useCallback(() => {
      fetchUser();
      setCurrentRole(auth.user?.role);
    }, [auth.user?.role])
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
    }
  };

  const openDeleteAccountConfirm = () => setDeleteAccountVisible(true);
  const closeDeleteAccountConfirm = () => {
    if (!deletingAccount) setDeleteAccountVisible(false);
  };

  const doDeleteAccount = async () => {
    if (!user?.id) {
      console.error('No user ID available for account deletion');
      return;
    }

    setDeletingAccount(true);
    try {
      const result = await requestAccountDeletion(
        user.id,
        'User requested account deactivation from mobile app'
      );

      if (result.success) {
        const days = result.days_remaining || 7;
        const deletionDate = result.scheduled_deletion_at
          ? new Date(result.scheduled_deletion_at).toLocaleDateString()
          : 'in 7 days';

        alert(
          `Account Deactivation Scheduled\n\n` +
            `Your account will be deactivated now and permanently deleted on ${deletionDate}.\n\n` +
            `You have ${days} days to change your mind.\n\n` +
            `To cancel the deactivation, simply log in again and your account will be automatically reactivated.\n\n` +
            `You will now be logged out.`
        );

        setTimeout(async () => {
          await auth.logout();
        }, 100);
      } else {
        alert(
          `Failed to request account deactivation: ${
            result.error || 'Unknown error occurred'
          }`
        );
      }
    } catch (error) {
      console.error('Account deactivation error:', error);
      alert(
        'An error occurred while requesting account deactivation. Please try again.'
      );
    } finally {
      setDeletingAccount(false);
      setDeleteAccountVisible(false);
    }
  };

  const handleRoleSwitch = async (newRole) => {
    setSwitchingRole(true);
    try {
      if (global.switchActiveRole) {
        global.switchActiveRole(newRole);
        setCurrentRole(newRole);
        setRoleSwitchVisible(false);
        Alert.alert('Success', `Switched to ${newRole} role`);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to switch role');
    } finally {
      setSwitchingRole(false);
    }
  };

  const name =
    user?.name || user?.full_name || user?.user_metadata?.name || '';
  const email = user?.email || '';
  const profilePhoto =
    user?.profile_photo ||
    user?.profile_photo_url ||
    user?.avatar_url ||
    user?.user_metadata?.profile_photo_url ||
    '';
  const avatarUrl = profilePhoto
    ? profilePhoto
    : name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
        name
      )}&background=6B2E2B&color=fff&size=128`
    : 'https://ui-avatars.com/api/?name=User&background=6B2E2B&color=fff&size=128';

  const navigateToEarningsDetail = () => {
    if (user) {
      navigation.navigate(Routes.DRIVER_EARNINGS);
    } else {
      Alert.alert('Login Required', 'Please log in to view detailed earnings.');
    }
  };

  const displayRole = (currentRole || auth.user?.role || '').toLowerCase();
  const isDualRole = displayRole === 'driver-owner';

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <TARTRACKHeader
          onMessagePress={() => navigation.navigate('Chat')}
          onNotificationPress={() => navigation.navigate('Notification')}
        />
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileLeft}>
          <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>
              {name || 'Set your account details'}
            </Text>
            {!!email && (
              <Text style={styles.profileEmail} numberOfLines={1}>
                {email}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.editIconBtn}
          onPress={() => navigation.navigate(Routes.ACCOUNT_DETAILS)}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <Ionicons name="create-outline" size={20} color={MAROON} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.sections}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Activity</Text>
        <View style={styles.card}>
          <ProfileItem
            icon={<Ionicons name="person-outline" size={22} color={MAROON} />}
            label="Account Details"
            onPress={() => navigation.navigate(Routes.ACCOUNT_DETAILS)}
          />
          <Divider />
          <ProfileItem
            icon={<Ionicons name="calendar-outline" size={22} color={MAROON} />}
            label={`My Bookings ${hasData ? `(${bookings.length})` : ''}`}
            onPress={() => navigation.navigate('BookingHistory')}
          />

          {(displayRole === 'tourist' || displayRole === 'driver-owner') && (
            <>
              <Divider />
              <ProfileItem
                icon={<Ionicons name="cash-outline" size={22} color={MAROON} />}
                label="Refunds"
                onPress={() => navigation.navigate(Routes.TOURIST_REFUND)}
              />
            </>
          )}

          {(displayRole === 'owner' || displayRole === 'driver-owner') && (
            <>
              <Divider />
              <ProfileItem
                icon={<Ionicons name="car-outline" size={22} color={MAROON} />}
                label={`My Carriages ${hasData ? `(${userCarriages.length})` : ''}`}
                onPress={() => navigation.navigate('MyCarriages')}
              />
            </>
          )}

          {(displayRole === 'driver' || displayRole === 'driver-owner') && (
            <>
              <Divider />
              <ProfileItem
                icon={<Ionicons name="cash-outline" size={22} color={MAROON} />}
                label="Earnings"
                onPress={navigateToEarningsDetail}
              />
              <Divider />
              <ProfileItem
                icon={<Ionicons name="map-outline" size={22} color={MAROON} />}
                label="My Tour Packages"
                onPress={() => navigation.navigate('MyTourPackages')}
              />
              <Divider />
              <ProfileItem
                icon={<Ionicons name="calendar-outline" size={22} color={MAROON} />}
                label="My Schedule"
                onPress={() => navigation.navigate('DriverSchedule')}
              />
            </>
          )}

          {displayRole === 'tourist' && (
            <>
              <Divider />
              <ProfileItem
                icon={<Ionicons name="star-outline" size={22} color={MAROON} />}
                label="Reviews"
                onPress={() => navigation.navigate(Routes.REVIEWS || 'Reviews')}
              />
            </>
          )}
        </View>

        {isDualRole && (
          <>
            <Text style={styles.sectionTitle}>Role Management</Text>
            <View style={styles.card}>
              <ProfileItem
                icon={<MaterialIcons name="swap-horiz" size={22} color={MAROON} />}
                label={`Switch Role (Current: ${currentRole})`}
                onPress={() => setRoleSwitchVisible(true)}
              />
            </View>
          </>
        )}

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
            onPress={() => setAboutVisible(true)}
          />
          <Divider />
          <ProfileItem
            icon={<Ionicons name="help-circle-outline" size={22} color={MAROON} />}
            label="Help Center"
            onPress={() => setHelpVisible(true)}
          />
        </View>

        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.card}>
          <ProfileItem
            icon={<MaterialIcons name="gavel" size={22} color={MAROON} />}
            label="General terms and conditions"
            onPress={() => setTermsVisible(true)}
          />
          <Divider />
          <ProfileItem
            icon={<MaterialIcons name="privacy-tip" size={22} color={MAROON} />}
            label="Privacy Policy"
            onPress={() => setPrivacyVisible(true)}
          />
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <Button
            title={
              <>
                <Ionicons
                  name="log-out-outline"
                  size={22}
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

        <Text style={styles.versionText}>TarTrack v1.0.0</Text>
      </ScrollView>

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
              You will be signed out of your account. You'll need to log in
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
                  <Text style={styles.modalPrimaryText}>Log out</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteAccountVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteAccountConfirm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconWrap, { backgroundColor: '#FDEAEA' }]}>
              <MaterialIcons name="delete-forever" size={30} color="#DC3545" />
            </View>

            <Text style={styles.modalTitle}>Deactivate Account</Text>
            <Text style={styles.modalDesc}>
              Your account will be deactivated now and scheduled for permanent
              deletion in 7 days. During this time, you can change your mind and
              cancel by simply logging in again. After 7 days, all your data
              will be permanently deleted and cannot be recovered.
            </Text>
            <Text
              style={[
                styles.modalDesc,
                { fontWeight: '600', color: '#DC3545', marginTop: 4 },
              ]}
            >
              You will be logged out immediately after confirming.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={closeDeleteAccountConfirm}
                disabled={deletingAccount}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: '#DC3545' },
                  deletingAccount && { opacity: 0.7 },
                ]}
                onPress={doDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Deactivate Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={roleSwitchVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !switchingRole && setRoleSwitchVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <MaterialIcons name="swap-horiz" size={30} color={MAROON} />
            </View>

            <Text style={styles.modalTitle}>Switch Role</Text>
            <Text style={styles.modalDesc}>
              Select a role to switch to.
            </Text>

            <View style={styles.roleButtonsContainer}>
              {['driver', 'owner'].map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleButton,
                    currentRole === role && styles.roleButtonActive,
                    switchingRole && { opacity: 0.6 }
                  ]}
                  onPress={() => handleRoleSwitch(role)}
                  disabled={switchingRole}
                >
                  {switchingRole ? (
                    <ActivityIndicator size="small" color={MAROON} />
                  ) : (
                    <Text style={[
                      styles.roleButtonText,
                      currentRole === role && styles.roleButtonTextActive
                    ]}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setRoleSwitchVisible(false)}
                disabled={switchingRole}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={aboutVisible} transparent animationType="slide" onRequestClose={() => setAboutVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAboutVisible(false)}>
          <View style={styles.contentModal} onStartShouldSetResponder={() => true}>
            <View style={styles.contentHeader}>
              <Text style={styles.contentTitle}>About TarTrack</Text>
              <TouchableOpacity onPress={() => setAboutVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.contentSubtitle}>Welcome to TarTrack</Text>
              <Text style={styles.contentText}>
                TarTrack is the premier mobile application connecting tourists with authentic tartanilla experiences in Cebu City.
              </Text>
              <Text style={styles.versionText}>Version 1.0.0</Text>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <HelpCenter visible={helpVisible} onClose={() => setHelpVisible(false)} />
      <TermsModal visible={termsVisible} onClose={() => setTermsVisible(false)} />
      <PrivacyModal visible={privacyVisible} onClose={() => setPrivacyVisible(false)} />
    </View>
  );
}

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
  hero: {
    backgroundColor: MAROON,
    paddingTop: 6,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  profileCard: {
    marginHorizontal: 16,
    marginTop: -12,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EFE7E4',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: MAROON,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  profileEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  editIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCD8',
  },
  sections: { flex: 1, marginTop: 10 },
  sectionTitle: {
    color: '#8A8A8A',
    fontSize: 13,
    marginLeft: 20,
    marginTop: 14,
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
    marginBottom: 8,
  },
  modalDesc: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 8,
    lineHeight: 20,
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
  roleButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  roleButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F0E7E3',
    borderWidth: 1,
    borderColor: MAROON,
    minWidth: '40%',
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: MAROON,
  },
  roleButtonText: {
    color: MAROON,
    fontWeight: '600',
    fontSize: 14,
  },
  roleButtonTextActive: {
    color: '#fff',
  },
  contentModal: {
    width: '90%',
    height: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  contentTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  closeBtn: {
    padding: 4,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  contentSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: MAROON,
    marginTop: 16,
    marginBottom: 8,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
    marginBottom: 12,
  },
});
