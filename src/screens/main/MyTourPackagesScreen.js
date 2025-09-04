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
        setPackages(result.data || []);
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
        Alert.alert('Error', result.error || 'Failed to update package status');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update package status');
    }
  };

  const renderPackage = (pkg, index) => (
    <View key={index} style={styles.packageCard}>
      {pkg.photos && pkg.photos.length > 0 && (
        <Image source={{ uri: pkg.photos[0].url }} style={styles.packageImage} />
      )}
      
      <View style={styles.packageContent}>
        <View style={styles.packageHeader}>
          <Text style={styles.packageName} numberOfLines={2}>
            {pkg.package_name}
          </Text>
          <View style={[styles.statusBadge, pkg.is_active ? styles.activeBadge : styles.inactiveBadge]}>
            <Text style={[styles.statusText, pkg.is_active ? styles.activeText : styles.inactiveText]}>
              {pkg.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        <Text style={styles.packageDescription} numberOfLines={2}>
          {pkg.description}
        </Text>

        <View style={styles.packageDetails}>
          <Text style={styles.price}>₱{pkg.price}</Text>
          <Text style={styles.duration}>{pkg.duration_hours}h • {pkg.max_pax} pax</Text>
        </View>

        <View style={styles.packageActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('EditTourPackage', { package: pkg })}
          >
            <Ionicons name="create-outline" size={18} color={MAROON} />
            <Text style={styles.actionText}>Edit</Text>
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
        </View>
      </View>
    </View>
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
  packageImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#F0F0F0',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
});