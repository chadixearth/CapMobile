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

export default function HelpScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={MAROON} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>How can we help you?</Text>
        
        <Text style={styles.sectionTitle}>Getting Started</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Q: How do I book a tartanilla ride?</Text>{'\n'}
          A: Simply open the app, select your pickup location, choose your destination, and confirm your booking. You'll be matched with the nearest available driver.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Q: How do I create an account?</Text>{'\n'}
          A: Tap "Sign Up" on the welcome screen, enter your details, verify your phone number, and you're ready to go!
        </Text>

        <Text style={styles.sectionTitle}>Booking & Rides</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Q: Can I cancel my booking?</Text>{'\n'}
          A: Yes, you can cancel your booking before the driver arrives. Cancellation fees may apply depending on timing.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Q: How do I track my tartanilla?</Text>{'\n'}
          A: Once your booking is confirmed, you'll see real-time tracking of your assigned tartanilla on the map.
        </Text>

        <Text style={styles.sectionTitle}>Payments</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Q: What payment methods are accepted?</Text>{'\n'}
          A: We accept cash payments, GCash, PayMaya, and major credit/debit cards.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Q: How is the fare calculated?</Text>{'\n'}
          A: Fares are based on distance, time, and current demand. You'll see the estimated fare before confirming your booking.
        </Text>

        <Text style={styles.sectionTitle}>Safety & Support</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Q: Is it safe to ride tartanillas?</Text>{'\n'}
          A: All our drivers are verified and carriages are regularly inspected. We also provide 24/7 support and emergency assistance.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Q: How do I report an issue?</Text>{'\n'}
          A: You can report issues through the app's feedback system or contact our support team directly.
        </Text>

        <Text style={styles.sectionTitle}>Contact Support</Text>
        <Text style={styles.paragraph}>
          Still need help? Our support team is available 24/7:{'\n\n'}
          📧 Email: support@tartrack.ph{'\n'}
          📞 Phone: +63 32 123 4567{'\n'}
          💬 In-app chat support
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
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    marginBottom: 16,
  },
  bold: {
    fontWeight: '700',
    color: '#1F2937',
  },
});