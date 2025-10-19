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

export default function AboutScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={MAROON} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About TarTrack</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Welcome to TarTrack</Text>
        
        <Text style={styles.paragraph}>
          TarTrack is the premier mobile application connecting tourists with authentic tartanilla experiences in Cebu City. Our platform bridges the gap between traditional horse-drawn carriage transportation and modern booking convenience.
        </Text>

        <Text style={styles.sectionTitle}>Our Mission</Text>
        <Text style={styles.paragraph}>
          To preserve and promote the cultural heritage of tartanilla transportation while providing tourists with safe, reliable, and memorable experiences throughout Cebu City's historic districts.
        </Text>

        <Text style={styles.sectionTitle}>What We Offer</Text>
        <Text style={styles.paragraph}>
          • Real-time tartanilla booking and tracking{'\n'}
          • Verified drivers and well-maintained carriages{'\n'}
          • Custom tour packages and routes{'\n'}
          • Secure payment processing{'\n'}
          • 24/7 customer support{'\n'}
          • Cultural and historical insights
        </Text>

        <Text style={styles.sectionTitle}>Our Story</Text>
        <Text style={styles.paragraph}>
          Founded in 2024, TarTrack emerged from a passion to preserve Cebu's rich transportation heritage while embracing modern technology. We work closely with local tartanilla operators to ensure sustainable tourism that benefits both visitors and the community.
        </Text>

        <Text style={styles.sectionTitle}>Contact Information</Text>
        <Text style={styles.paragraph}>
          Email: support@tartrack.ph{'\n'}
          Phone: +63 32 123 4567{'\n'}
          Address: Cebu City, Philippines
        </Text>

        <Text style={styles.version}>Version 1.0.0</Text>
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
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
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
  },
  version: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
});