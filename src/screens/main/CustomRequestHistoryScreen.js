import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl, 
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BackButton from '../../components/BackButton';
import { getCustomerCustomRequests } from '../../services/specialpackage/customPackageRequest';
import { getCurrentUser } from '../../services/authService';

const MAROON = '#6B2E2B';

export default function CustomRequestHistoryScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUserAndRequests();
  }, []);

  const fetchUserAndRequests = async () => {
    try {
      setLoading(true);
      
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        
        console.log('Fetching custom requests for user ID:', currentUser.id);
        const requestsData = await getCustomerCustomRequests(currentUser.id);
        console.log('Custom requests data received:', requestsData);
        
        if (requestsData.success) {
          setRequests(requestsData.data || []);
        } else {
          console.error('Error fetching requests:', requestsData.error);
          Alert.alert('Error', requestsData.error || 'Failed to load your custom requests');
        }
      } else {
        Alert.alert('Error', 'Please log in to view your custom requests');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching custom requests:', error);
      Alert.alert('Error', `Failed to load your custom requests: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserAndRequests();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'rejected':
        return '#F44336';
      case 'in_progress':
        return '#2196F3';
      case 'completed':
        return '#9C27B0';
      default:
        return '#757575';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'rejected':
        return 'close-circle';
      case 'in_progress':
        return 'sync';
      case 'completed':
        return 'checkmark-done-circle';
      default:
        return 'help-circle';
    }
  };

  const getRequestTypeIcon = (requestType) => {
    return requestType === 'custom_tour' ? 'map' : 'star';
  };

  const getRequestTypeLabel = (requestType) => {
    return requestType === 'custom_tour' ? 'Custom Tour' : 'Special Event';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return `₱${parseFloat(amount).toFixed(2)}`;
  };

  const renderRequestCard = (request) => (
    <View key={request.id} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestInfo}>
          <View style={styles.typeAndStatus}>
            <View style={styles.typeContainer}>
              <Ionicons 
                name={getRequestTypeIcon(request.request_type)} 
                size={16} 
                color={MAROON} 
              />
              <Text style={styles.requestType}>
                {getRequestTypeLabel(request.request_type)}
              </Text>
            </View>
            <View style={styles.statusContainer}>
              <Ionicons 
                name={getStatusIcon(request.status)} 
                size={18} 
                color={getStatusColor(request.status)} 
              />
              <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                {request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : 'Unknown'}
              </Text>
            </View>
          </View>
          <Text style={styles.requestDate}>
            Created: {formatDate(request.created_at)}
          </Text>
        </View>
      </View>

      <View style={styles.requestDetails}>
        {/* Custom Tour Details */}
        {request.request_type === 'custom_tour' && (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Destination:</Text>
              <Text style={styles.detailValue}>{request.destination || 'N/A'}</Text>
            </View>
            
            {request.preferred_duration_hours && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Duration:</Text>
                <Text style={styles.detailValue}>{request.preferred_duration_hours} hours</Text>
              </View>
            )}
            
            {request.preferred_date && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Preferred Date:</Text>
                <Text style={styles.detailValue}>{formatDate(request.preferred_date)}</Text>
              </View>
            )}
          </>
        )}

        {/* Special Event Details */}
        {request.request_type === 'special_event' && (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Event Type:</Text>
              <Text style={styles.detailValue}>{request.event_type || 'N/A'}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Event Date:</Text>
              <Text style={styles.detailValue}>{formatDate(request.event_date)}</Text>
            </View>
            
            {request.event_time && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Event Time:</Text>
                <Text style={styles.detailValue}>{request.event_time}</Text>
              </View>
            )}
          </>
        )}

        {/* Common Details */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Passengers:</Text>
          <Text style={styles.detailValue}>{request.number_of_pax || 'N/A'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>
            {request.request_type === 'special_event' ? 'Event Address:' : 'Pickup Location:'}
          </Text>
          <Text style={styles.detailValue}>
            {request.pickup_location || request.event_address || 'N/A'}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Contact:</Text>
          <Text style={styles.detailValue}>{request.contact_number || 'N/A'}</Text>
        </View>
        
        {(request.special_requests || request.special_requirements) && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Special Requests:</Text>
            <Text style={styles.detailValue}>
              {request.special_requests || request.special_requirements}
            </Text>
          </View>
        )}

        {request.admin_response && (
          <View style={styles.adminResponseContainer}>
            <Text style={styles.adminResponseLabel}>Admin Response:</Text>
            <Text style={styles.adminResponse}>{request.admin_response}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateTitle}>No Custom Requests</Text>
      <Text style={styles.emptyStateSubtitle}>
        You haven't made any custom package requests yet. Create one to get started!
      </Text>
      <TouchableOpacity 
        style={styles.createButton}
        onPress={() => navigation.navigate('CustomPackageRequest')}
      >
        <Text style={styles.createButtonText}>Create Custom Request</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Custom Request History</Text>
          {/* <Text style={styles.subtitle}>
            {user?.name || user?.user_metadata?.name || user?.email || 'Your'} custom package requests
          </Text> */}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading your custom requests...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            {requests.length > 0 ? (
              <>
                <View style={styles.summary}>
                  <Text style={styles.summaryText}>
                    {requests.length} custom request{requests.length !== 1 ? 's' : ''} found
                  </Text>
                  <TouchableOpacity 
                    style={styles.newRequestButton}
                    onPress={() => navigation.navigate('CustomPackageRequest')}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={styles.newRequestButtonText}>New Request</Text>
                  </TouchableOpacity>
                </View>
                {requests.map(renderRequestCard)}
              </>
            ) : (
              renderEmptyState()
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    marginTop: 23,
    marginLeft: 40,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  newRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MAROON,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  newRequestButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  requestHeader: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  requestInfo: {
    flex: 1,
  },
  typeAndStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 6,
  },
  requestDate: {
    fontSize: 12,
    color: '#666',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  requestDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  adminResponseContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  adminResponseLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  adminResponse: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  descriptionContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  createButton: {
    backgroundColor: MAROON,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
