// screens/main/OwnerHomeScreen.jsx
import React, { useMemo, useState, useLayoutEffect, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { carriageService } from '../../services/tourpackage/fetchCarriage';
import { getCurrentUser } from '../../services/authService';
import NotificationService from '../../services/notificationService';
import { useNotifications } from '../../contexts/NotificationContext';

const MAROON = '#6B2E2B';
const TEXT_DARK = '#1F1F1F';
const RADIUS = 16;
const { height: SCREEN_H } = Dimensions.get('window');

// Local image for tartanillas
const tartanillaImage = require('../../../assets/tartanilla.jpg');

// Default image for tartanillas
const getCarriageImage = (carriage) => {
  if (carriage?.image_url) {
    return { uri: carriage.image_url };
  }
  return tartanillaImage;
};

// Remove dummy notifications - will use real notifications from API

export default function OwnerHomeScreen({ navigation }) {
  // Hide the default stack header (keep only TARTRACKHeader)
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [selected, setSelected] = useState(null);
  const [visible, setVisible] = useState(false);
  const [carriages, setCarriages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const y = useMemo(() => new Animated.Value(SCREEN_H), []);
  const { unreadCount } = useNotifications();

  // Fetch owner's carriages and notifications
  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser?.id) {
          // Fetch carriages
          const ownerCarriages = await carriageService.getByOwner(currentUser.id);
          setCarriages(ownerCarriages || []);
          
          // Fetch notifications
          const notificationResult = await NotificationService.getNotifications(currentUser.id);
          if (notificationResult.success) {
            // Get latest 3 notifications for preview
            const latestNotifications = (notificationResult.data || []).slice(0, 3).map(notif => ({
              id: notif.id,
              title: notif.title,
              body: notif.message,
              time: formatNotificationTime(notif.created_at),
              read: notif.read
            }));
            setNotifications(latestNotifications);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setCarriages([]);
        setNotifications([]);
      } finally {
        setLoading(false);
        setNotificationsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatNotificationTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch {
      return 'now';
    }
  };

  const openSheet = (item) => {
    setSelected(item);
    setVisible(true);
    Animated.timing(y, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(y, {
      toValue: SCREEN_H,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.in(Easing.cubic),
    }).start(() => {
      setVisible(false);
      setSelected(null);
    });
  };

  const preview = carriages.slice(0, 2);

  const getNotificationIcon = (title) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('booking') || titleLower.includes('request')) return 'calendar-outline';
    if (titleLower.includes('payment') || titleLower.includes('paid')) return 'card-outline';
    if (titleLower.includes('driver') || titleLower.includes('assigned')) return 'car-outline';
    if (titleLower.includes('cancelled') || titleLower.includes('cancel')) return 'close-circle-outline';
    if (titleLower.includes('completed') || titleLower.includes('finished')) return 'checkmark-circle-outline';
    return 'notifications-outline';
  };

  return (
    <View style={styles.container}>
      {/* Custom Header with Chat + Notification */}
      <TARTRACKHeader
        onMessagePress={() => navigation.navigate('Chat')}
        onNotificationPress={() => navigation.navigate('Notification')}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Latest Notifications */}
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Latest Notifications</Text>
          <TouchableOpacity onPress={() => navigation?.navigate?.('Notification')}>
            <Text style={styles.link}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {notificationsLoading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={MAROON} />
              <Text style={{ marginTop: 8, color: '#666' }}>Loading notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Ionicons name="notifications-outline" size={32} color="#ccc" />
              <Text style={{ marginTop: 8, color: '#666' }}>No notifications yet</Text>
            </View>
          ) : (
            notifications.map((n) => (
              <View key={n.id} style={[styles.notifRow, !n.read && styles.unreadNotif]}>
                <View style={styles.notifIconWrap}>
                  <Ionicons 
                    name={getNotificationIcon(n.title)} 
                    size={18} 
                    color={MAROON} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.notifHeader}>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifTime}>{n.time}</Text>
                  </View>
                  <Text style={styles.notifBody} numberOfLines={2}>
                    {n.body}
                  </Text>
                  {!n.read && <View style={styles.unreadDot} />}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Quick Cards */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => navigation?.navigate?.('DriversScreen')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="car-sport" size={22} color={MAROON} />
              <Text style={{ marginLeft: 10, fontWeight: '700', color: TEXT_DARK }}>
                Drivers
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => navigation?.navigate?.('BookingsScreen')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="calendar-outline" size={22} color={MAROON} />
              <Text style={{ marginLeft: 10, fontWeight: '700', color: TEXT_DARK }}>
                Bookings
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* List of Tartanillas (preview - max 2) */}
        <View style={[styles.headerRow, { marginTop: 10 }]}>
          <Text style={styles.sectionTitle}>List of Tartanilla Carriages</Text>
          <TouchableOpacity onPress={() => navigation?.navigate?.('MyCarriages')}>
            <Text style={styles.link}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { paddingVertical: 12 }]}>
          {loading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={MAROON} />
              <Text style={{ marginTop: 8, color: '#666' }}>Loading carriages...</Text>
            </View>
          ) : preview.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Ionicons name="car-outline" size={32} color="#ccc" />
              <Text style={{ marginTop: 8, color: '#666' }}>No carriages found</Text>
            </View>
          ) : (
            <FlatList
              data={preview}
              keyExtractor={(i) => String(i.id)}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              renderItem={({ item }) => (
                <View style={styles.tartanillaRow}>
                  <Image source={getCarriageImage(item)} style={styles.tartanillaImg} />
                  <View style={styles.tartanillaInfo}>
                    <Text style={styles.tcCode}>{item.carriage_code || item.code || `TC${item.id}`}</Text>

                    {/* Plate Number */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <Ionicons name="car-outline" size={16} color="#444" />
                      <Text style={styles.tcPlate}> {item.plate_number || 'No plate number'}</Text>
                    </View>

                    {/* Driver with people icon */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Ionicons name="people-outline" size={16} color="#444" />
                      <Text style={styles.tcDriver}> {item.driver_name || item.driver?.name || 'No driver assigned'}</Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <TouchableOpacity style={styles.seeBtn} onPress={() => openSheet(item)}>
                        <Text style={styles.seeBtnText}>See Details</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => {
                      /* optional later */
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#7D7D7D" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>

        {/* DETAILS BOTTOM SHEET */}
        <Modal visible={visible} transparent animationType="none" onRequestClose={closeSheet}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeSheet} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: y }] }]}>
            {selected && (
              <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <View style={styles.driverHeader}>
                  <Image source={getCarriageImage(selected)} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.headerCode}>{selected.carriage_code || selected.code || `TC${selected.id}`}</Text>
                    <Text style={styles.headerDriver}>Driver : {selected.driver_name || selected.driver?.name || 'No driver assigned'}</Text>
                  </View>
                </View>

                <View style={styles.detailCard}>
                  <Text style={styles.detailLine}>
                    <Text style={styles.bold}>Carriage Code : </Text>
                    {selected.carriage_code || selected.code || `TC${selected.id}`}
                  </Text>
                  <Text style={styles.detailLine}>
                    <Text style={styles.bold}>Plate Number : </Text>
                    {selected.plate_number || 'No plate number'}
                  </Text>
                  <Text style={styles.detailLine}>
                    <Text style={styles.bold}>Driver Name : </Text>
                    {selected.driver_name || selected.driver?.name || 'No driver assigned'}
                  </Text>
                  {selected.driver_email && (
                    <Text style={styles.detailLine}>
                      <Text style={styles.bold}>Driver Email : </Text>
                      {selected.driver_email}
                    </Text>
                  )}
                  {selected.driver_phone && (
                    <Text style={styles.detailLine}>
                      <Text style={styles.bold}>Driver Contact : </Text>
                      {selected.driver_phone}
                    </Text>
                  )}
                  {selected.capacity && (
                    <Text style={styles.detailLine}>
                      <Text style={styles.bold}>Capacity : </Text>
                      {selected.capacity} passengers
                    </Text>
                  )}
                  {selected.status && (
                    <Text style={styles.detailLine}>
                      <Text style={styles.bold}>Status : </Text>
                      {selected.status}
                    </Text>
                  )}
                </View>

                <TouchableOpacity style={styles.closeBtn} onPress={closeSheet}>
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Animated.View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  headerRow: {
    marginTop: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: TEXT_DARK },
  link: { color: '#7D7D7D', fontSize: 12 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  // Notifications
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  notifIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  notifTitle: { fontWeight: '700', color: TEXT_DARK },
  notifTime: { color: '#9A9A9A', fontSize: 11 },
  notifBody: { color: '#6D6D6D', fontSize: 12, marginTop: 2 },
  unreadNotif: {
    backgroundColor: '#f8f9fa',
  },
  unreadDot: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
  },

  // Quick card
  quickCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Tartanilla preview
  tartanillaRow: {
    backgroundColor: '#fff',
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: '#ECECEC',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 100,
    position: 'relative',
  },
  tartanillaImg: {
    width: 120,
    height: '100%',
    resizeMode: 'cover',
  },
  tartanillaInfo: {
    flex: 1,
    padding: 12,
    backgroundColor: '#fdf2ef',
    borderTopRightRadius: RADIUS,
    borderBottomRightRadius: RADIUS,
  },
  tcCode: {
    color: '#fff',
    backgroundColor: MAROON,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    fontWeight: '700',
    alignSelf: 'flex-start',
  },
  tcPlate: { color: '#2C2C2C', fontSize: 12, fontWeight: '600' },
  tcDriver: { color: '#2C2C2C', fontSize: 12 },
  seeBtn: {
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  seeBtnText: { color: '#3D3D3D', fontWeight: '600', fontSize: 12 },
  trashBtn: { position: 'absolute', right: 10, top: 10 },

  // Bottom sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: SCREEN_H * 0.32,
    backgroundColor: '#F9F9F9',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
  },
  driverHeader: {
    backgroundColor: MAROON,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: '#fff' },
  headerCode: { color: '#fff', fontWeight: '800', marginBottom: 4 },
  headerDriver: { color: '#F4EDED' },

  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  detailLine: { color: '#3A3A3A', marginVertical: 3 },
  bold: { fontWeight: '700' },

  closeBtn: {
    marginTop: 12,
    alignSelf: 'center',
    backgroundColor: MAROON,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 24,
  },
  closeText: { color: '#fff', fontWeight: '700' },
});
