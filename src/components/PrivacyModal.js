import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAROON = '#6B2E2B';
const MUTED = '#6F6F6F';

export default function PrivacyModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.contentModal}>
          <View style={styles.contentHeader}>
            <Text style={styles.contentTitle}>Privacy Policy</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={MUTED} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.contentScroll} contentContainerStyle={{ paddingBottom: 20 }}>
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