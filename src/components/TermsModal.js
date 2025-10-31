import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAROON = '#6B2E2B';
const MUTED = '#6F6F6F';

export default function TermsModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.contentModal}>
          <View style={styles.contentHeader}>
            <Text style={styles.contentTitle}>Terms & Conditions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={MUTED} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.contentScroll} contentContainerStyle={{ paddingBottom: 20 }}>
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
  lastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
});