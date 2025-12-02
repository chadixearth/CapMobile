import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { submitDriverReport } from '../../services/reportService';
import { useAuth } from '../../hooks/useAuth';
import ReportModal from '../../components/ReportModal';

const MAROON = '#6B2E2B';

export default function ReportDriverScreen({ navigation, route }) {
  const { booking } = route.params;
  const { user } = useAuth();
  const [showReportModal, setShowReportModal] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReport = async (reportData) => {
    setSubmitting(true);
    try {
      await submitDriverReport(
        booking.id,
        booking.driver_id,
        user.id,
        reportData
      );
      
      Alert.alert(
        'Report Submitted',
        'Your report has been submitted successfully and will be reviewed by admin. Unjustified reports may result in action against your account.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Driver</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="warning-outline" size={48} color="#DC3545" />
          <Text style={styles.infoTitle}>Important Notice</Text>
          <Text style={styles.infoText}>
            Please only submit reports for genuine issues. All reports are reviewed by admin.
          </Text>
          <Text style={styles.warningText}>
            ⚠️ Unjustified or false reports may result in suspension of your account.
          </Text>
        </View>

        <View style={styles.bookingCard}>
          <Text style={styles.cardTitle}>Booking Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Package:</Text>
            <Text style={styles.detailValue}>
              {booking.package_data?.package_name || 'Tour Package'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date:</Text>
            <Text style={styles.detailValue}>
              {booking.booking_date ? new Date(booking.booking_date + 'T00:00:00').toLocaleDateString() : 'N/A'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Driver:</Text>
            <Text style={styles.detailValue}>
              {booking.driver_data?.name || 'Driver'}
            </Text>
          </View>
        </View>
      </ScrollView>

      <ReportModal
        visible={showReportModal}
        onClose={handleClose}
        onSubmit={handleSubmitReport}
        loading={submitting}
        reporterType="tourist"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    backgroundColor: MAROON,
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  warningText: {
    fontSize: 13,
    color: '#DC3545',
    textAlign: 'center',
    fontWeight: '600',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
  bookingCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
});
