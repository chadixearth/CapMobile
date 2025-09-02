// screens/chat/MessagesListScreen.jsx
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAROON = '#6B2E2B';
const GREY_TEXT = '#222';
const ORANGE = '#F59E0B';

const THREADS = [
  { id: 'support', name: 'TarTrack Chat Support', lastMessage: 'Thank you for reaching out.', time: '12:51', unread: false },
];

// local back button with the exact look you specified
function BackBtn({ onPress }) {
  return (
    <TouchableOpacity style={styles.backBtn} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name="arrow-back" size={22} color="#fff" />
    </TouchableOpacity>
  );
}

export default function MessagesListScreen({ navigation }) {
  const [tab, setTab] = useState('all');
  const data = useMemo(() => (tab === 'unread' ? THREADS.filter(t => t.unread) : THREADS), [tab]);

  const openThread = (item) => {
    navigation.navigate('ChatScreen', { chatId: item.id, name: item.name });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => openThread(item)} activeOpacity={0.85}>
      <View style={styles.leftIconWrap}>
        <Ionicons name="chatbubble-ellipses-outline" size={22} color={MAROON} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
          {!item.unread && <Ionicons name="checkmark-done" size={16} color={ORANGE} />}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* back button (absolute) */}
      <BackBtn onPress={() => navigation.goBack?.()} />

      {/* centered screen title, visually aligned with the back button */}
      <Text style={styles.screenTitle}>Messages</Text>

      {/* tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('all')}>
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>All Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('unread')}>
          <Text style={[styles.tabText, tab === 'unread' && styles.tabTextActive]}>Unread</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // exact back button style you provided
  backBtn: {
    backgroundColor: '#6B2E2B',
    borderRadius: 20,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    position: 'absolute',
    top: 37,
    left: 18,
    zIndex: 10,
  },

  // centered title; offset down to line up with the back button like in your mock
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: GREY_TEXT,
    textAlign: 'center',
    marginTop: 35,  // aligns with back button vertical placement
    marginBottom: 8,
  },

  tabs: { flexDirection: 'row', marginTop: 8, marginHorizontal: 16, gap: 20 },
  tabBtn: { paddingVertical: 6 },
  tabText: { color: '#777', fontWeight: '700' },
  tabTextActive: { color: GREY_TEXT },

 card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(107,46,43,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(107,46,43,0.12)',
    marginBottom: 12,
  },
  leftIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F7EFEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '800', color: '#1F1F1F', maxWidth: '75%' },
  time: { color: '#9A9A9A', fontSize: 12 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  preview: { color: '#6D6D6D', fontSize: 12, marginRight: 10 },
});
