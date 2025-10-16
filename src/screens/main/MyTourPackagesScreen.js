import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMyTourPackages, togglePackageStatus } from '../../services/tourPackageService';

const MAROON = '#6B2E2B';
const BG = '#F8F8F8';
const CARD = '#FFFFFF';

export default function MyTourPackagesScreen({ navigation }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPackages = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await getMyTourPackages();
      if (result.success) {
        const packages = result.data || [];
        // Debug: Log photos data
        packages.forEach(pkg => {
          if (pkg.photos) {
            console.log(`Package ${pkg.package_name} photos:`, pkg.photos);
          }
        });
        setPackages(packages);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const onRefresh = () => {
    fetchPackages(true);
  };

  const handleToggleStatus = async (packageId, currentStatus) => {
    try {
      const result = await togglePackageStatus(packageId);
      if (result.success) {
        Alert.alert(
          'Success',
          `Package ${currentStatus ? 'deactivated' : 'activated'} successfully`
        );
        fetchPackages();
      } else {
        if (result.code === 'CONFLICT') {
          Alert.alert(
            currentStatus ? 'Cannot Deactivate' : 'Cannot Activate',
            result.error,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', result.error || 'Failed to update package status');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update package status');
    }
  };

  const renderPackage = (pkg, index) => (
    <TouchableOpacity 
      key={index} 
      style={styles.packageCard}
      onPress={() => navigation.navigate('PackageDetails', { package: pkg })}
      activeOpacity={0.7}
    >
      {pkg.photos && Array.isArray(pkg.photos) && pkg.photos.length > 0 ? (
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: pkg.photos[0].url }} 
            style={styles.packageImage}
            onError={() => console.log('Image load error:', pkg.photos[0].url)}
          />
          {pkg.photos.length > 1 && (
            <View style={styles.imageCountBadge}>
              <Ionicons name="images-outline" size={12} color="#fff" />
              <Text style={styles.imageCountText}>{pkg.photos.length}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.placeholderImage}>
          <Ionicons name="image-outline" size={32} color="#CCC" />
          <Text style={styles.placeholderText}>No Image</Text>
        </View>
      )}
      
      <View style={styles.packageContent}>
        <View style={styles.packageHeader}>
          <Text style={styles.packageName} numberOfLines={2}>
            {pkg.package_name}
          </Text>
          <View style={styles.badgeContainer}>
            <View style={[styles.statusBadge, pkg.is_active ? styles.activeBadge : styles.inactiveBadge]}>
              <Text style={[styles.statusText, pkg.is_active ? styles.activeText : styles.inactiveText]}>
                {pkg.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.packageDescription} numberOfLines={2}>
          {pkg.description}
        </Text>

        <View style={styles.packageDetails}>
          <Text style={styles.price}>₱{pkg.price}</Text>
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={14} color="#666" />
              <Text style={styles.detailText}>{pkg.duration_hours}h</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={14} color="#666" />
              <Text style={styles.detailText}>{pkg.max_pax} pax</Text>
            </View>
            {pkg.unfinished_bookings_count > 0 && (
              <View style={styles.detailItem}>
                <Ionicons name="hourglass-outline" size={14} color="#FF6B35" />
                <Text style={[styles.detailText, { color: '#FF6B35' }]}>{pkg.unfinished_bookings_count} pending</Text>
              </View>
            )}
          </View>
        </View>

        {/* Locations */}
        {(pkg.pickup_location || pkg.destination) && (
          <View style={styles.locationSection}>
            {pkg.pickup_location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={16} color="#666" />
                <Text style={styles.locationText}>Pickup: {pkg.pickup_location}</Text>
              </View>
            )}
            {pkg.destination && (
              <View style={styles.locationRow}>
                <Ionicons name="flag-outline" size={16} color="#666" />
                <Text style={styles.locationText}>Destination: {pkg.destination}</Text>
              </View>
            )}
          </View>
        )}

        {/* Schedule Info */}
        <View style={styles.scheduleSection}>
          {(pkg.available_days || pkg.available_days_data) && (
            <View style={styles.scheduleRow}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.scheduleText}>
                Available: {(pkg.available_days || pkg.available_days_data || []).map(day => day.substring(0, 3)).join(', ') || 'Not specified'}
              </Text>
            </View>
          )}
          {(pkg.expiration_date || pkg.expiration_date_data) && (
            <View style={styles.scheduleRow}>
              <Ionicons name="hourglass-outline" size={16} color="#666" />
              <Text style={styles.scheduleText}>
                Expires: {new Date(pkg.expiration_date || pkg.expiration_date_data).toLocaleDateString()}
              </Text>
            </View>
          )}
          <View style={styles.scheduleRow}>
            <Ionicons name="create-outline" size={16} color="#666" />
            <Text style={styles.scheduleText}>
              Created: {new Date(pkg.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.packageActions}>
          <TouchableOpacity
            style={[styles.actionButton, !pkg.can_edit && styles.disabledButton]}
            onPress={() => {
              if (pkg.can_edit) {
                navigation.navigate('EditTourPackage', { package: pkg });
              } else {
                Alert.alert(
                  'Cannot Edit Package',
                  `This package has ${pkg.unfinished_bookings_count} unfinished booking(s). Complete or cancel existing bookings first.`,
                  [{ text: 'OK' }]
                );
              }
            }}
            disabled={!pkg.can_edit}
          >
            <Ionicons 
              name="create-outline" 
              size={18} 
              color={pkg.can_edit ? MAROON : '#CCC'} 
            />
            <Text style={[styles.actionText, !pkg.can_edit && styles.disabledText]}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleToggleStatus(pkg.id, pkg.is_active)}
          >
            <Ionicons 
              name={pkg.is_active ? 'pause-outline' : 'play-outline'} 
              size={18} 
              color={pkg.is_active ? '#DC3545' : '#28A745'} 
            />
            <Text style={[styles.actionText, { color: pkg.is_active ? '#DC3545' : '#28A745' }]}>
              {pkg.is_active ? 'Deactivate' : 'Activate'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('PackageDetails', { package: pkg })}
          >
            <Ionicons name="eye-outline" size={18} color={MAROON} />
            <Text style={styles.actionText}>View Details</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>Tap to view bookings and reviews</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Tour Packages</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateTourPackage')}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={MAROON} />
            <Text style={styles.loadingText}>Loading packages...</Text>
          </View>
        ) : packages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="map-outline" size={64} color="#DDD" />
            <Text style={styles.emptyTitle}>No Tour Packages</Text>
            <Text style={styles.emptyText}>
              Create your first tour package to start offering tours to customers.
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('CreateTourPackage')}
            >
              <Text style={styles.createButtonText}>Create Package</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.packagesList}>
            {packages.map(renderPackage)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    backgroundColor: MAROON,
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    width: 40,
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  packagesList: {
    gap: 16,
  },
  packageCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  imageContainer: {
    position: 'relative',
  },
  packageImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#F0F0F0',
  },
  imageCountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  imageCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  placeholderImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  placeholderText: {
    color: '#CCC',
    fontSize: 12,
  },
  packageContent: {
    padding: 16,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  badgeContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#E8F5E8',
  },
  inactiveBadge: {
    backgroundColor: '#FFF2F2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeText: {
    color: '#28A745',
  },
  inactiveText: {
    color: '#DC3545',
  },
  packageDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  packageDetails: {
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: MAROON,
  },
  duration: {
    fontSize: 14,
    color: '#666',
  },
  packageActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: MAROON,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#CCC',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
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
  locationSection: {
    marginBottom: 12,
    gap: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  scheduleSection: {
    marginBottom: 16,
    gap: 6,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  tapHint: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    alignItems: 'center',
  },
  tapHintText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});