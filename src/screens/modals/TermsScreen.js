import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAROON = '#6B2E2B';

export default function TermsScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={MAROON} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>General Terms and Conditions</Text>
        <Text style={styles.lastUpdated}>Last updated: January 2024</Text>
        
        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          By accessing and using the TarTrack mobile application, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
        </Text>

        <Text style={styles.sectionTitle}>2. Service Description</Text>
        <Text style={styles.paragraph}>
          TarTrack provides a platform that connects users with tartanilla transportation services in Cebu City. We facilitate bookings between passengers and verified drivers but do not directly provide transportation services.
        </Text>

        <Text style={styles.sectionTitle}>3. User Responsibilities</Text>
        <Text style={styles.paragraph}>
          Users must provide accurate information during registration, maintain the confidentiality of their account credentials, and use the service in accordance with applicable laws and regulations. Users are responsible for all activities that occur under their account.
        </Text>

        <Text style={styles.sectionTitle}>4. Booking and Cancellation</Text>
        <Text style={styles.paragraph}>
          All bookings are subject to driver availability. Cancellation policies apply and may result in fees depending on timing. Users agree to pay all applicable fares and fees associated with their bookings.
        </Text>

        <Text style={styles.sectionTitle}>5. Payment Terms</Text>
        <Text style={styles.paragraph}>
          Payment for services must be made through approved payment methods. All transactions are processed securely. Refunds are subject to our refund policy and may take 3-5 business days to process.
        </Text>

        <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          TarTrack acts as an intermediary platform and is not liable for any damages, injuries, or losses that may occur during transportation services. Users acknowledge that they use the service at their own risk.
        </Text>

        <Text style={styles.sectionTitle}>7. Privacy and Data Protection</Text>
        <Text style={styles.paragraph}>
          We collect and process personal data in accordance with our Privacy Policy. By using our service, you consent to the collection and use of your information as outlined in our privacy policy.
        </Text>

        <Text style={styles.sectionTitle}>8. Prohibited Activities</Text>
        <Text style={styles.paragraph}>
          Users may not use the service for illegal activities, harassment of drivers or other users, or any activity that violates local laws or regulations. Violation may result in account suspension or termination.
        </Text>

        <Text style={styles.sectionTitle}>9. Modifications to Terms</Text>
        <Text style={styles.paragraph}>
          TarTrack reserves the right to modify these terms at any time. Users will be notified of significant changes, and continued use of the service constitutes acceptance of modified terms.
        </Text>

        <Text style={styles.sectionTitle}>10. Contact Information</Text>
        <Text style={styles.paragraph}>
          For questions regarding these terms, please contact us at legal@tartrack.ph or +63 32 123 4567.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: MAROON,
    marginBottom: 8,
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    marginBottom: 12,
    textAlign: 'justify',
  },
});