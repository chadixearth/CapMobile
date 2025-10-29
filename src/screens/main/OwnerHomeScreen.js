// screens/main/OwnerHomeScreen.jsx
import React, { useMemo, useState, useLayoutEffect, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { carriageService } from '../../services/tourpackage/fetchCarriage';
import { getCurrentUser } from '../../services/authService';
import NotificationService from '../../services/notificationService';
import { useNotifications } from '../../contexts/NotificationContext';
import driverService from '../../services/carriages/fetchDriver';
import { Alert, TextInput } from 'react-native';

const MAROON = '#6B2E2B';
const TEXT_DARK = '#1F1F1F';
const RADIUS = 16;
const { height: SCREEN_H } = Dimensions.get('window');

// Local image for tartanillas
const tartanillaImage = require('../../../assets/tartanilla.jpg');

// Default image for tartanillas
const getCarriageImage = (carriage) => {
  if (carriage?.image_url) {
    return { uri: carriage.image_url };
  }
  return tartanillaImage;
};

// Remove dummy notifications - will use real notifications from API

export default function OwnerHomeScreen({ navigation }) {
  // Hide the default stack header (keep only TARTRACKHeader)
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [selected, setSelected] = useState(null);
  const [visible, setVisible] = useState(false);
  const [carriages, setCarriages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [driverCache, setDriverCache] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCarriage, setEditingCarriage] = useState(null);
  const [editForm, setEditForm] = useState({ capacity: '4', status: 'available', notes: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const y = useMemo(() => new Animated.Value(SCREEN_H), []);
  const { unreadCount } = useNotifications();

  // Fetch owner's carriages and notifications
  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser?.id) {
          // Fetch carriages
          const ownerCarriages = await carriageService.getByOwner(currentUser.id);
          setCarriages(ownerCarriages || []);
          
          // Fetch notifications
          const notificationResult = await NotificationService.getNotifications(currentUser.id);
          if (notificationResult.success) {
            // Get latest 3 notifications for preview
            const latestNotifications = (notificationResult.data || []).slice(0, 3).map(notif => ({
              id: notif.id,
              title: notif.title,
              body: notif.message,
              time: formatNotificationTime(notif.created_at),
              read: notif.read
            }));
            setNotifications(latestNotifications);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setCarriages([]);
        setNotifications([]);
      } finally {
        setLoading(false);
        setNotificationsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch missing driver details when carriages change
  useEffect(() => {
    const fetchMissingDrivers = async () => {
      try {
        const idsToFetch = (carriages || [])
          .map(c => c.assigned_driver ? null : c.assigned_driver_id)
          .filter(id => !!id && !driverCache[id]);

        if (idsToFetch.length === 0) return;

        // Try to fetch all drivers and cache them
        try {
          const allDrivers = await driverService.getAllDrivers();
          const updates = {};
          (Array.isArray(allDrivers) ? allDrivers : []).forEach(d => {
            if (d?.id) updates[String(d.id)] = d;
            if (d?.user_id) updates[String(d.user_id)] = d;
          });
          if (Object.keys(updates).length > 0) {
            setDriverCache(prev => ({ ...prev, ...updates }));
          }
        } catch (e) {
          console.error('Error fetching drivers:', e);
        }
      } catch (e) {
        // ignore
      }
    };
    fetchMissingDrivers();
  }, [carriages, driverCache]);

  const formatNotificationTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch {
      return 'now';
    }
  };

  const openSheet = (item) => {
    setSelected(item);
    setVisible(true);
    Animated.timing(y, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(y, {
      toValue: SCREEN_H,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.in(Easing.cubic),
    }).start(() => {
      setVisible(false);
      setSelected(null);
    });
  };

  const preview = carriages.slice(0, 2);

  const getStatusStyle = (status) => {
    const statusStyles = {
      available: { backgroundColor: '#ECFDF5' },
      in_use: { backgroundColor: '#FEF2F2' },
      maintenance: { backgroundColor: '#FFFBEB' },
      waiting_driver_acceptance: { backgroundColor: '#FFFBEB' },
      driver_assigned: { backgroundColor: '#EFF6FF' },
      not_usable: { backgroundColor: '#FEF2F2' },
      suspended: { backgroundColor: '#FFFBEB' },
      out_of_service: { backgroundColor: '#FEF2F2' },
    };
    return statusStyles[status?.toLowerCase()] || { backgroundColor: '#F9FAFB' };
  };

  const getStatusColor = (status) => {
    const statusColors = {
      available: '#10B981',
      in_use: '#EF4444',
      maintenance: '#F59E0B',
      waiting_driver_acceptance: '#F59E0B',
      driver_assigned: '#3B82F6',
      not_usable: '#EF4444',
      suspended: '#F59E0B',
      out_of_service: '#EF4444',
    };
    return statusColors[status?.toLowerCase()] || '#6B7280';
  };

  const getStatusIcon = (status) => {
    const statusIcons = {
      available: 'checkmark-circle',
      in_use: 'time',
      maintenance: 'build',
      waiting_driver_acceptance: 'hourglass-outline',
      driver_assigned: 'person-circle',
      not_usable: 'close-circle',
      suspended: 'pause-circle',
      out_of_service: 'close-circle',
    };
    return statusIcons[status?.toLowerCase()] || 'help-circle';
  };

  const getStatusText = (status) => {
    const statusTexts = {
      available: 'Available',
      in_use: 'In Use',
      maintenance: 'Maintenance',
      waiting_driver_acceptance: 'Pending Driver',
      driver_assigned: 'Driver Assigned',
      not_usable: 'Not Usable',
      suspended: 'Suspended',
      out_of_service: 'Out of Service',
    };
    return statusTexts[status?.toLowerCase()] || 'Unknown';
  };

  const openEditModal = (carriage) => {
    setEditingCarriage(carriage);
    setEditForm({
      capacity: String(carriage.capacity || '4'),
      status: (carriage.status && carriage.status !== 'driver_assigned') ? carriage.status : 'available',
      notes: carriage.notes || ''
    });
    setShowEditModal(true);
  };

  const validateEditForm = () => {
    const errors = {};
    const cap = parseInt(editForm.capacity);
    if (isNaN(cap) || cap < 1 || cap > 10) {
      errors.capacity = 'Capacity must be between 1 and 10';
    }
    if (!editForm.status) {
      errors.status = 'Status is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateCarriage = async () => {
    if (!editingCarriage) return;
    if (!validateEditForm()) return;
    setSavingEdit(true);
    try {
      const updates = {
        capacity: parseInt(editForm.capacity) || undefined,
        status: editForm.status,
        notes: editForm.notes ?? ''
      };
      Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

      await carriageService.updateCarriage(editingCarriage.id, updates);

      setShowEditModal(false);
      setEditingCarriage(null);
      
      // Refresh carriages
      const currentUser = await getCurrentUser();
      if (currentUser?.id) {
        const ownerCarriages = await carriageService.getByOwner(currentUser.id);
        setCarriages(ownerCarriages || []);
      }
      
      Alert.alert('Success', 'Carriage updated successfully');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update carriage');
    } finally {
      setSavingEdit(false);
    }
  };

  const buildName = (d) => {
    if (!d) return null;
    return (
      d.name ||
      d.full_name || d.fullName ||
      (d.first_name || d.last_name ? `${d.first_name || ''} ${d.last_name || ''}`.trim() : null) ||
      d.user?.name ||
      (d.user && (d.user.first_name || d.user.last_name) ? `${d.user.first_name || ''} ${d.user.last_name || ''}`.trim() : null) ||
      d.username ||
      d.email || (typeof d.email === 'string' ? d.email : null) ||
      null
    );
  };

  const getNotificationIcon = (title) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('booking') || titleLower.includes('request')) return 'calendar-outline';
    if (titleLower.includes('payment') || titleLower.includes('paid')) return 'card-outline';
    if (titleLower.includes('driver') || titleLower.includes('assigned')) return 'car-outline';
    if (titleLower.includes('cancelled') || titleLower.includes('cancel')) return 'close-circle-outline';
    if (titleLower.includes('completed') || titleLower.includes('finished')) return 'checkmark-circle-outline';
    return 'notifications-outline';
  };

  return (
    <View style={styles.container}>
      {/* Custom Header with Chat + Notification */}
      <TARTRACKHeader
        onMessagePress={() => navigation.navigate('Chat')}
        onNotificationPress={() => navigation.navigate('Notification')}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Latest Notifications */}
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Latest Notifications</Text>
          <TouchableOpacity onPress={() => navigation?.navigate?.('Notification')}>
            <Text style={styles.link}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {notificationsLoading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={MAROON} />
              <Text style={{ marginTop: 8, color: '#666' }}>Loading notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Ionicons name="notifications-outline" size={32} color="#ccc" />
              <Text style={{ marginTop: 8, color: '#666' }}>No notifications yet</Text>
            </View>
          ) : (
            notifications.map((n) => (
              <View key={n.id} style={[styles.notifRow, !n.read && styles.unreadNotif]}>
                <View style={styles.notifIconWrap}>
                  <Ionicons 
                    name={getNotificationIcon(n.title)} 
                    size={18} 
                    color={MAROON} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.notifHeader}>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifTime}>{n.time}</Text>
                  </View>
                  <Text style={styles.notifBody} numberOfLines={2}>
                    {n.body}
                  </Text>
                  {!n.read && <View style={styles.unreadDot} />}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Quick Cards */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => navigation?.navigate?.('DriversList')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="car-sport" size={22} color={MAROON} />
              <Text style={{ marginLeft: 10, fontWeight: '700', color: TEXT_DARK }}>
                Drivers
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* List of Tartanillas (preview - max 2) */}
        <View style={[styles.headerRow, { marginTop: 10 }]}>
          <Text style={styles.sectionTitle}>List of Tartanilla Carriages</Text>
          <TouchableOpacity onPress={() => navigation?.navigate?.('MyCarriages')}>
            <Text style={styles.link}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { paddingVertical: 12 }]}>
          {loading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={MAROON} />
              <Text style={{ marginTop: 8, color: '#666' }}>Loading carriages...</Text>
            </View>
          ) : preview.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Ionicons name="car-outline" size={32} color="#ccc" />
              <Text style={{ marginTop: 8, color: '#666' }}>No carriages found</Text>
            </View>
          ) : (
            <FlatList
              data={preview}
              keyExtractor={(i) => String(i.id)}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              renderItem={({ item }) => (
                <View style={styles.tartanillaRow}>
                  <Image source={getCarriageImage(item)} style={styles.tartanillaImg} />
                  <View style={styles.tartanillaInfo}>
                    <Text style={styles.tcCode}>{item.carriage_code || item.code || `TC${String(item.id).slice(-4)}`}</Text>

                    {/* Plate Number */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <Ionicons name="car-outline" size={16} color="#444" />
                      <Text style={styles.tcPlate}> {item.plate_number || 'No plate number'}</Text>
                    </View>

                    {/* Driver with people icon */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Ionicons name="people-outline" size={16} color="#444" />
                      <Text style={styles.tcDriver} numberOfLines={1}> {buildName(item.assigned_driver) || buildName(item.driver) || buildName(driverCache[item.assigned_driver_id]) || (item.assigned_driver_id ? 'Unknown Driver' : 'No driver assigned')}</Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <TouchableOpacity style={styles.seeBtn} onPress={() => openSheet(item)}>
                        <Text style={styles.seeBtnText}>See Details</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => openEditModal(item)}
                  >
                    <Ionicons name="pencil-outline" size={18} color="#7D7D7D" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>

        {/* DETAILS BOTTOM SHEET */}
        <Modal visible={visible} transparent animationType="none" onRequestClose={closeSheet}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeSheet} />
            <Animated.View style={[styles.modernSheet, { transform: [{ translateY: y }] }]}>
              {selected && (
                <>
                  <View style={styles.modalHandle} />
                  <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                    {/* Hero Section */}
                    <View style={styles.heroSection}>
                      <Image source={getCarriageImage(selected)} style={styles.heroImage} />
                      <View style={styles.heroOverlay}>
                        <Text style={styles.heroCode}>{selected.carriage_code || selected.code || `TC${String(selected.id).slice(-4)}`}</Text>
                        {selected.status && (
                          <View style={[styles.heroStatusBadge, getStatusStyle(selected.status)]}>
                            <Ionicons name={getStatusIcon(selected.status)} size={14} color={getStatusColor(selected.status)} />
                            <Text style={[styles.heroStatusText, { color: getStatusColor(selected.status) }]}>
                              {getStatusText(selected.status)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Quick Stats */}
                    <View style={styles.quickStats}>
                      <View style={styles.statCard}>
                        <Ionicons name="people" size={20} color={MAROON} />
                        <Text style={styles.statNumber}>{selected.capacity || 'N/A'}</Text>
                        <Text style={styles.statLabel}>Capacity</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Ionicons name="car" size={20} color={MAROON} />
                        <Text style={styles.statNumber}>{selected.plate_number ? '✓' : '✗'}</Text>
                        <Text style={styles.statLabel}>Plate</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Ionicons name="person" size={20} color={MAROON} />
                        <Text style={styles.statNumber}>{buildName(selected.assigned_driver) || buildName(selected.driver) || buildName(driverCache[selected.assigned_driver_id]) ? '✓' : '✗'}</Text>
                        <Text style={styles.statLabel}>Driver</Text>
                      </View>
                    </View>

                    {/* Details Cards */}
                    <View style={styles.detailsContainer}>
                      {/* Vehicle Info Card */}
                      <View style={styles.infoCard}>
                        <View style={styles.cardHeader}>
                          <Ionicons name="car-outline" size={20} color={MAROON} />
                          <Text style={styles.cardTitle}>Vehicle Information</Text>
                        </View>
                        <View style={styles.cardContent}>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Carriage Code</Text>
                            <Text style={styles.infoValue}>{selected.carriage_code || selected.code || `TC${String(selected.id).slice(-4)}`}</Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Plate Number</Text>
                            <Text style={styles.infoValue}>{selected.plate_number || 'Not assigned'}</Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Passenger Capacity</Text>
                            <Text style={styles.infoValue}>{selected.capacity || 'N/A'} passengers</Text>
                          </View>
                        </View>
                      </View>

                      {/* Driver Info Card */}
                      <View style={styles.infoCard}>
                        <View style={styles.cardHeader}>
                          <Ionicons name="person-outline" size={20} color={MAROON} />
                          <Text style={styles.cardTitle}>Driver Information</Text>
                        </View>
                        <View style={styles.cardContent}>
                          {buildName(selected.assigned_driver) || buildName(selected.driver) || buildName(driverCache[selected.assigned_driver_id]) ? (
                            <>
                              <View style={styles.driverProfile}>
                                <View style={styles.driverAvatar}>
                                  <Ionicons name="person" size={24} color={MAROON} />
                                </View>
                                <View style={styles.driverInfo}>
                                  <Text style={styles.driverName}>{buildName(selected.assigned_driver) || buildName(selected.driver) || buildName(driverCache[selected.assigned_driver_id])}</Text>
                                  {(selected.driver_email || selected.assigned_driver?.email) && (
                                    <Text style={styles.driverContact}>✉️ {selected.driver_email || selected.assigned_driver?.email}</Text>
                                  )}
                                  {(selected.driver_phone || selected.assigned_driver?.phone) && (
                                    <Text style={styles.driverContact}>📱 {selected.driver_phone || selected.assigned_driver?.phone}</Text>
                                  )}
                                </View>
                              </View>
                            </>
                          ) : (
                            <View style={styles.noDriverState}>
                              <Ionicons name="person-add-outline" size={32} color="#ccc" />
                              <Text style={styles.noDriverText}>No driver assigned</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Notes Card (if exists) */}
                      {selected.notes && (
                        <View style={styles.infoCard}>
                          <View style={styles.cardHeader}>
                            <Ionicons name="document-text-outline" size={20} color={MAROON} />
                            <Text style={styles.cardTitle}>Notes</Text>
                          </View>
                          <View style={styles.cardContent}>
                            <Text style={styles.notesText}>{selected.notes}</Text>
                          </View>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity style={styles.modernCloseBtn} onPress={closeSheet}>
                      <Ionicons name="close" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.modernCloseText}>Close</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </>
              )}
            </Animated.View>
          </View>
        </Modal>

        {/* Edit Carriage Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showEditModal}
          onRequestClose={() => !savingEdit && setShowEditModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.editModalContent}>
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>Edit Carriage</Text>
                <TouchableOpacity onPress={() => !savingEdit && setShowEditModal(false)} disabled={savingEdit}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.editModalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Plate Number</Text>
                  <TextInput style={[styles.input, { backgroundColor: '#f5f5f5' }]} value={editingCarriage?.plate_number || ''} editable={false} />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Capacity *</Text>
                  <View style={styles.capacityContainer}>
                    <TouchableOpacity 
                      style={styles.capacityButton}
                      onPress={() => setEditForm(prev => ({ ...prev, capacity: String(Math.max(1, (parseInt(prev.capacity) || 4) - 1)) }))}
                      disabled={savingEdit}
                    >
                      <Ionicons name="remove" size={20} color="#666" />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, styles.capacityInput, formErrors.capacity && styles.inputError]}
                      value={editForm.capacity}
                      onChangeText={(text) => setEditForm(prev => ({ ...prev, capacity: text }))}
                      keyboardType="numeric"
                      editable={!savingEdit}
                    />
                    <TouchableOpacity 
                      style={styles.capacityButton}
                      onPress={() => setEditForm(prev => ({ ...prev, capacity: String(Math.min(10, (parseInt(prev.capacity) || 4) + 1)) }))}
                      disabled={savingEdit}
                    >
                      <Ionicons name="add" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                  {formErrors.capacity && <Text style={styles.errorText}>{formErrors.capacity}</Text>}
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Status *</Text>
                  <View style={styles.statusOptions}>
                    {['available', 'in_use', 'maintenance', 'out_of_service'].map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusOption,
                          editForm.status === status && styles.statusOptionSelected,
                          { backgroundColor: getStatusStyle(status).backgroundColor }
                        ]}
                        onPress={() => setEditForm(prev => ({ ...prev, status }))}
                        disabled={savingEdit}
                      >
                        <Ionicons name={getStatusIcon(status)} size={16} color={getStatusColor(status)} style={styles.statusIcon} />
                        <Text style={[styles.statusOptionText, { color: getStatusColor(status) }, editForm.status === status && styles.statusOptionTextSelected]}>
                          {getStatusText(status)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {formErrors.status && <Text style={styles.errorText}>{formErrors.status}</Text>}
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Notes (Optional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Any additional notes about this carriage"
                    value={editForm.notes}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, notes: text }))}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    editable={!savingEdit}
                  />
                </View>
              </ScrollView>
              <View style={styles.editModalFooter}>
                <TouchableOpacity style={[styles.button, styles.cancelButton, savingEdit && styles.buttonDisabled]} onPress={() => setShowEditModal(false)} disabled={savingEdit}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.saveButton, savingEdit && styles.buttonDisabled]} onPress={handleUpdateCarriage} disabled={savingEdit}>
                  {savingEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  headerRow: {
    marginTop: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: TEXT_DARK },
  link: { color: '#7D7D7D', fontSize: 12 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  // Notifications
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  notifIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  notifTitle: { fontWeight: '700', color: TEXT_DARK },
  notifTime: { color: '#9A9A9A', fontSize: 11 },
  notifBody: { color: '#6D6D6D', fontSize: 12, marginTop: 2 },
  unreadNotif: {
    backgroundColor: '#f8f9fa',
  },
  unreadDot: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
  },

  // Quick card
  quickCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Tartanilla preview
  tartanillaRow: {
    backgroundColor: '#fff',
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: '#ECECEC',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 100,
    position: 'relative',
  },
  tartanillaImg: {
    width: 120,
    height: '100%',
    resizeMode: 'cover',
  },
  tartanillaInfo: {
    flex: 1,
    padding: 12,
    backgroundColor: '#fdf2ef',
    borderTopRightRadius: RADIUS,
    borderBottomRightRadius: RADIUS,
  },
  tcCode: {
    color: '#fff',
    backgroundColor: MAROON,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    fontWeight: '700',
    alignSelf: 'flex-start',
  },
  tcPlate: { color: '#2C2C2C', fontSize: 12, fontWeight: '600' },
  tcDriver: { color: '#2C2C2C', fontSize: 12 },
  seeBtn: {
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  seeBtnText: { color: '#3D3D3D', fontWeight: '600', fontSize: 12 },
  trashBtn: { position: 'absolute', right: 10, top: 10 },

  // Modern Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheetBackdrop: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modernSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: SCREEN_H * 0.15,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  
  // Hero Section
  heroSection: {
    position: 'relative',
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroCode: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  heroStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  heroStatusText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  
  // Quick Stats
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_DARK,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  
  // Details Container
  detailsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_DARK,
    marginLeft: 8,
  },
  cardContent: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_DARK,
    flex: 1,
    textAlign: 'right',
  },
  
  // Driver Profile
  driverProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: 4,
  },
  driverContact: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  noDriverState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noDriverText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  
  // Notes
  notesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  
  // Close Button
  modernCloseBtn: {
    backgroundColor: MAROON,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modernCloseText: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 16,
  },
  
  // Edit Modal Styles
  editModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    alignSelf: 'center',
    marginTop: '10%',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: MAROON,
  },
  editModalBody: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  editModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  capacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  capacityButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  capacityInput: {
    flex: 1,
    textAlign: 'center',
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusOptionSelected: {
    borderColor: MAROON,
  },
  statusIcon: {
    marginRight: 6,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusOptionTextSelected: {
    fontWeight: '700',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  saveButton: {
    backgroundColor: MAROON,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
});
