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
  Alert,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import ProfileItem from '../../components/ProfileItem';
import * as Routes from '../../constants/routes';
import Button from '../../components/Button';
import { getCurrentUser, getUserProfile } from '../../services/authService';
import { supabase } from '../../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { requestAccountDeletion } from '../../services/accountDeletionService';
import { useAuthData } from '../../hooks/useAuthData';
import { getMyActiveRides } from '../../services/rideHailingService';

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
      // Check for active rides before logout
      const currentUser = await getCurrentUser();
      if (currentUser?.id) {
        const activeRidesResult = await getMyActiveRides(currentUser.id);
        if (activeRidesResult.success && activeRidesResult.data && activeRidesResult.data.length > 0) {
          Alert.alert(
            'Active Ride Found',
            'You have an active ride booking. Please complete or cancel your ride before logging out.',
            [{ text: 'OK' }]
          );
          setLoggingOut(false);
          setLogoutVisible(false);
          return;
        }
      }
      
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

  const role = (auth.user?.role || '').toLowerCase();

  return (
    <View style={styles.container}>
      {/* Compact header area */}
      <View style={styles.hero}>
        {/* Your requested TARTRACKHeader usage (shows chat+bell via handlers) */}
        <TARTRACKHeader
          onMessagePress={() => navigation.navigate('Chat')}
          onNotificationPress={() => navigation.navigate('Notification')}
        />
      </View>

      {/* Floating profile card */}
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

        {/* Icon-only edit */}
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
            icon={<Ionicons name="calendar-outline" size={22} color={MAROON} />}
            label={`My Bookings ${hasData ? `(${bookings.length})` : ''}`}
            onPress={() => navigation.navigate('BookingHistory')}
          />

          {/* Tourist-only */}
          {role === 'tourist' && (
            <>
              <Divider />
              <ProfileItem
                icon={<Ionicons name="cash-outline" size={22} color={MAROON} />}
                label="Refunds"
                onPress={() => navigation.navigate(Routes.TOURIST_REFUND)}
              />
            </>
          )}

          {/* Driver/Owner-only */}
          {(role === 'driver' || role === 'owner') && (
            <>
              <Divider />
              <ProfileItem
                icon={<Ionicons name="car-outline" size={22} color={MAROON} />}
                label={`My Carriages ${hasData ? `(${userCarriages.length})` : ''}`}
                onPress={() => navigation.navigate('MyCarriages')}
              />
              <Divider />
              <ProfileItem
                icon={<Ionicons name="cash-outline" size={22} color={MAROON} />}
                label="Earnings"
                onPress={navigateToEarningsDetail}
              />
              {role === 'driver' && (
                <>
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
            </>
          )}

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
            onPress={() => setAboutVisible(true)}
          />
          <Divider />
          <ProfileItem
            icon={<Ionicons name="help-circle-outline" size={22} color={MAROON} />}
            label="Help Center"
            onPress={() => setHelpVisible(true)}
          />
        </View>

        {/* Legal */}
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

        {/* Log Out (inside scroll, right below Legal) */}
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

        {/* Version label right after logout */}
        <Text style={styles.versionText}>TarTrack v1.0.0</Text>
      </ScrollView>

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

      {/* Deactivate Account Modal */}
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

      {/* About Modal */}
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
                TarTrack is the premier mobile application connecting tourists with authentic tartanilla experiences in Cebu City. Our platform bridges the gap between traditional horse-drawn carriage transportation and modern booking convenience.
              </Text>
              <Text style={styles.contentSubtitle}>Our Mission</Text>
              <Text style={styles.contentText}>
                To preserve and promote the cultural heritage of tartanilla transportation while providing tourists with safe, reliable, and memorable experiences throughout Cebu City's historic districts.
              </Text>
              <Text style={styles.contentSubtitle}>Contact Information</Text>
              <Text style={styles.contentText}>
                Email: support@tartrack.ph{"\n"}
                Phone: +63 32 123 4567{"\n"}
                Address: Cebu City, Philippines
              </Text>
              <Text style={styles.versionText}>Version 1.0.0</Text>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Help Modal */}
      <Modal visible={helpVisible} transparent animationType="slide" onRequestClose={() => setHelpVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setHelpVisible(false)}>
          <View style={styles.contentModal} onStartShouldSetResponder={() => true}>
            <View style={styles.contentHeader}>
              <Text style={styles.contentTitle}>Help Center</Text>
              <TouchableOpacity onPress={() => setHelpVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.contentSubtitle}>Getting Started</Text>
              <Text style={styles.contentText}>
                <Text style={styles.boldText}>Q: How do I book a tartanilla ride?</Text>{"\n"}
                A: Simply open the app, select your pickup location, choose your destination, and confirm your booking.
              </Text>
              <Text style={styles.contentSubtitle}>Booking & Rides</Text>
              <Text style={styles.contentText}>
                <Text style={styles.boldText}>Q: Can I cancel my booking?</Text>{"\n"}
                A: Yes, you can cancel your booking before the driver arrives. Cancellation fees may apply.
              </Text>
              <Text style={styles.contentSubtitle}>Payments</Text>
              <Text style={styles.contentText}>
                <Text style={styles.boldText}>Q: What payment methods are accepted?</Text>{"\n"}
                A: We accept cash payments, GCash, PayMaya, and major credit/debit cards.
              </Text>
              <Text style={styles.contentSubtitle}>Contact Support</Text>
              <Text style={styles.contentText}>
                📧 Email: support@tartrack.ph{"\n"}
                📞 Phone: +63 32 123 4567{"\n"}
                💬 In-app chat support
              </Text>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Terms Modal */}
      <Modal visible={termsVisible} transparent animationType="slide" onRequestClose={() => setTermsVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setTermsVisible(false)}>
          <View style={styles.contentModal} onStartShouldSetResponder={() => true}>
            <View style={styles.contentHeader}>
              <Text style={styles.contentTitle}>Terms & Conditions</Text>
              <TouchableOpacity onPress={() => setTermsVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.lastUpdated}>Last updated: January 2024</Text>
              <Text style={styles.contentSubtitle}>1. Acceptance of Terms</Text>
              <Text style={styles.contentText}>
                By accessing and using the TarTrack mobile application, you accept and agree to be bound by the terms and provision of this agreement.
              </Text>
              <Text style={styles.contentSubtitle}>2. Service Description</Text>
              <Text style={styles.contentText}>
                TarTrack provides a platform that connects users with tartanilla transportation services in Cebu City. We facilitate bookings between passengers and verified drivers.
              </Text>
              <Text style={styles.contentSubtitle}>3. User Responsibilities</Text>
              <Text style={styles.contentText}>
                Users must provide accurate information during registration, maintain the confidentiality of their account credentials, and use the service in accordance with applicable laws.
              </Text>
              <Text style={styles.contentSubtitle}>4. Contact Information</Text>
              <Text style={styles.contentText}>
                For questions regarding these terms, please contact us at legal@tartrack.ph or +63 32 123 4567.
              </Text>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Privacy Modal */}
      <Modal visible={privacyVisible} transparent animationType="slide" onRequestClose={() => setPrivacyVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPrivacyVisible(false)}>
          <View style={styles.contentModal} onStartShouldSetResponder={() => true}>
            <View style={styles.contentHeader}>
              <Text style={styles.contentTitle}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setPrivacyVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.lastUpdated}>Last updated: January 2024</Text>
              <Text style={styles.contentSubtitle}>1. Information We Collect</Text>
              <Text style={styles.contentText}>
                We collect information you provide directly to us, such as when you create an account, make a booking, or contact us for support.
              </Text>
              <Text style={styles.contentSubtitle}>2. How We Use Your Information</Text>
              <Text style={styles.contentText}>
                We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.
              </Text>
              <Text style={styles.contentSubtitle}>3. Data Security</Text>
              <Text style={styles.contentText}>
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access.
              </Text>
              <Text style={styles.contentSubtitle}>4. Contact Us</Text>
              <Text style={styles.contentText}>
                📧 Email: privacy@tartrack.ph{"\n"}
                📞 Phone: +63 32 123 4567{"\n"}
                📍 Address: Cebu City, Philippines
              </Text>
            </ScrollView>
          </View>
        </Pressable>
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

  // Compact header container (just enough space for the header)
  hero: {
    backgroundColor: MAROON,
    paddingTop: 6,
    paddingBottom: 18, // minimal to keep it tight
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },

  // Floating profile card
    profileCard: {
    marginHorizontal: 16,
    marginTop: -12,
    backgroundColor: '#fff',
    borderRadius: 18,           // 16 → 18
    paddingVertical: 14,        // 10 → 14
    paddingHorizontal: 14,      // 10 → 14
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

  // Content
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

  /* Modals */
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
  
  // Content modal styles
  contentModal: {
    marginHorizontal: 20,
    marginTop: 60,
    marginBottom: 40,
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '85%',
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
    paddingVertical: 16,
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
  boldText: {
    fontWeight: '700',
    color: '#1F2937',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
});
