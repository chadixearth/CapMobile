import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAROON = '#6B2E2B';
const MUTED = '#6F6F6F';

export default function HelpCenter({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.contentModal}>
          <View style={styles.contentHeader}>
            <Text style={styles.contentTitle}>Help Center</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={MUTED} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 20 }}>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
  boldText: {
    fontWeight: '700',
    color: '#1F2937',
  },
});