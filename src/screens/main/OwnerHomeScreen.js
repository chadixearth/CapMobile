// screens/main/OwnerHomeScreen.jsx
import React, { useMemo, useState } from 'react';
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

const MAROON = '#6B2E2B';
const MAROON_LIGHT = '#F5E9E2';
const TEXT_DARK = '#1F1F1F';
const MUTED = '#6B6B6B';
const CARD_BG = '#FFFFFF';
const SURFACE = '#F7F7F7';
const RADIUS = 16;
const { height: SCREEN_H } = Dimensions.get('window');

// Local image for tartanillas
const tartanillaImage = require('../../../assets/tartanilla.jpg');

// ---- Helpers ----
const formatCurrency = (n = 0) =>
  `₱ ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const formatPercentage = (n = 0) => `${Math.abs(Number(n || 0)).toFixed(1)}%`;

// Mock data (replace with your API later)
const MOCK_TARTANILLAS = [
  {
    id: '1',
    code: 'TC143',
    driver: {
      name: 'Carlos Sainz Jr.',
      email: 'carlossainz55@gmail.com',
      phone: '09202171442',
      birthdate: 'September 1, 1994',
      address: 'Secret City',
      avatar: 'https://i.pravatar.cc/128?img=68',
    },
    photo: tartanillaImage,
  },
  {
    id: '2',
    code: 'TC144',
    driver: {
      name: 'Lando Norris',
      email: 'lando@example.com',
      phone: '09171234567',
      birthdate: 'November 13, 1999',
      address: 'Cebu City',
      avatar: 'https://i.pravatar.cc/128?img=12',
    },
    photo: tartanillaImage,
  },
  {
    id: '3',
    code: 'TC145',
    driver: {
      name: 'Max Verstappen',
      email: 'max@example.com',
      phone: '09991234567',
      address: 'Lapu-Lapu City',
      avatar: 'https://i.pravatar.cc/128?img=5',
    },
    photo: tartanillaImage,
  },
];

const NOTIFS = [
  {
    id: 'n1',
    title: 'Announcement',
    body:
      'Customer A booked the photo shoot in events. See bookings for more details.',
    time: '01:51',
  },
  {
    id: 'n2',
    title: 'Announcement',
    body:
      'You declined the wedding shoot booking. See booking history for more details.',
    time: '01:52',
  },
];

// Mock earnings (owner)
const MOCK_EARNINGS = {
  total_owner_earnings: 12340.0,
  earnings_today: 520.0,
  number_tartanillas: 5,
  avg_earning_per_tartanilla: 457.0,
  trend: { percentage_change: 8.3, is_increase: true },
};

export default function OwnerHomeScreen({ navigation }) {
  const [selected, setSelected] = useState(null);
  const [visible, setVisible] = useState(false);
  const [loadingEarnings] = useState(false); // set true when wiring real API
  const y = useMemo(() => new Animated.Value(SCREEN_H), []);

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

  const preview = MOCK_TARTANILLAS.slice(0, 2);

  // Earnings values (swap with real data later)
  const totalEarnings = MOCK_EARNINGS.total_owner_earnings || 0;
  const todayEarnings = MOCK_EARNINGS.earnings_today || 0;
  const changeData =
    MOCK_EARNINGS.trend || { percentage_change: 0, is_increase: true };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Earnings Card (revised to match mock) */}
      <View style={styles.incomeCard}>
        <View style={styles.incomeTopRow}>
          <Text style={styles.incomeTitle}>Owner Earnings (Month)</Text>
          <View
            style={[
              styles.trendChip,
              { backgroundColor: changeData.is_increase ? '#EAF7EE' : '#FDEEEE' },
            ]}
          >
            <Ionicons
              name={
                changeData.is_increase
                  ? 'trending-up-outline'
                  : 'trending-down-outline'
              }
              size={14}
              color={changeData.is_increase ? '#2E7D32' : '#C62828'}
            />
            <Text
              style={[
                styles.trendText,
                { color: changeData.is_increase ? '#2E7D32' : '#C62828' },
              ]}
            >
              {changeData.is_increase ? '+' : '-'}
              {formatPercentage(changeData.percentage_change)}
            </Text>
          </View>
        </View>

        <View style={styles.incomeMainRow}>
          <View style={{ flex: 1 }}>
            {loadingEarnings ? (
              <ActivityIndicator />
            ) : (
              <>
                <Text style={styles.incomeAmount}>
                  {formatCurrency(totalEarnings)}
                </Text>
                <Text style={styles.incomeSub}>
                  {todayEarnings > 0
                    ? `Today: ${formatCurrency(todayEarnings)}`
                    : 'No earnings yet today'}
                </Text>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.detailBtn}
            onPress={() => navigation?.navigate?.('OwnerEarningsScreen')}
          >
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bottom stats aligned with mock */}
        <View style={styles.splitRow}>
          <View style={styles.splitCol}>
            <Text style={styles.splitLabel}>Tartanillas</Text>
            <Text style={styles.splitValue}>
              {MOCK_EARNINGS.number_tartanillas || 0}
            </Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.splitCol}>
            <Text style={styles.splitLabel}>Avg / tartanilla</Text>
            <Text style={styles.splitValue}>
              {formatCurrency(MOCK_EARNINGS.avg_earning_per_tartanilla || 0)}
            </Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.splitCol}>
            <Text style={styles.splitLabel}>Today</Text>
            <Text style={styles.splitValue}>
              {formatCurrency(todayEarnings || 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* Latest Notifications */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Latest Notifications</Text>
        <TouchableOpacity
          onPress={() => navigation?.navigate?.('NotificationScreen')}
        >
          <Text style={styles.link}>View all</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {NOTIFS.map((n) => (
          <View key={n.id} style={styles.notifRow}>
            <View style={styles.notifIconWrap}>
              <Ionicons name="calendar-outline" size={18} color={MAROON} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.notifHeader}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifTime}>{n.time}</Text>
              </View>
              <Text style={styles.notifBody} numberOfLines={2}>
                {n.body}
              </Text>
            </View>
          </View>
        ))}
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
        <TouchableOpacity
          onPress={() => navigation?.navigate?.('TartanillaCarriages')}
        >
          <Text style={styles.link}>View all</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { paddingVertical: 12 }]}>
        <FlatList
          data={preview}
          keyExtractor={(i) => i.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <View style={styles.tartanillaRow}>
              <Image source={item.photo} style={styles.tartanillaImg} />
              <View style={styles.tartanillaInfo}>
                <Text style={styles.tcCode}>{item.code}</Text>

                {/* Driver with people icon */}
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}
                >
                  <Ionicons name="people-outline" size={16} color="#444" />
                  <Text style={styles.tcDriver}> {item.driver.name}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <TouchableOpacity
                    style={styles.seeBtn}
                    onPress={() => openSheet(item)}
                  >
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
      </View>

      {/* DETAILS BOTTOM SHEET */}
      <Modal visible={visible} transparent animationType="none" onRequestClose={closeSheet}>
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={closeSheet}
        />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: y }] }]}>
          {selected && (
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={styles.driverHeader}>
                <Image source={selected.photo} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerCode}>{selected.code}</Text>
                  <Text style={styles.headerDriver}>
                    Driver : {selected.driver.name}
                  </Text>
                </View>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailLine}>
                  <Text style={styles.bold}>Name : </Text>
                  {selected.driver.name}
                </Text>
                {!!selected.driver.birthdate && (
                  <Text style={styles.detailLine}>
                    <Text style={styles.bold}>Birth Date : </Text>
                    {selected.driver.birthdate}
                  </Text>
                )}
                <Text style={styles.detailLine}>
                  <Text style={styles.bold}>Contact # : </Text>
                  {selected.driver.phone}
                </Text>
                <Text style={styles.detailLine}>
                  <Text style={styles.bold}>Email : </Text>
                  {selected.driver.email}
                </Text>
                {!!selected.driver.address && (
                  <Text style={styles.detailLine}>
                    <Text style={styles.bold}>Home Address : </Text>
                    {selected.driver.address}
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

  // Earnings (revised)
  incomeCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 1,
    borderColor: '#F0E7E3',
  },
  incomeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  incomeTitle: { color: TEXT_DARK, fontWeight: '800', fontSize: 14 },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
  },
  trendText: { fontWeight: '800', fontSize: 12 },
  incomeMainRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  incomeAmount: { fontSize: 28, fontWeight: '900', color: TEXT_DARK, letterSpacing: 0.2 },
  incomeSub: { color: MUTED, marginTop: 2, fontSize: 12 },
  detailBtn: {
    backgroundColor: MAROON,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  vDivider: { width: 1, height: 24, backgroundColor: '#EAEAEA' },
  splitCol: { flex: 1, alignItems: 'center' },
  splitLabel: { color: MUTED, fontSize: 11, marginBottom: 2 },
  splitValue: { color: TEXT_DARK, fontSize: 13, fontWeight: '800' },

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
    resizeMode: 'cover', // fill left side
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
