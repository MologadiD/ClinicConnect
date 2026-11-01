// src/screens/admin/ClinicManagementScreen.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { clinicApi } from '../../services/api/clinic';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { StatusFilter, StatusFilterValue, matchesStatus } from '../../components/StatusFilter';

interface Clinic {
  id: string;
  clinic_name: string;
  location: string;
  operating_hours: string;
  contact_details: string;
  status: 'active' | 'inactive';
}

export default function ClinicManagementScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('active');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [form, setForm] = useState({
    clinic_name: '',
    location: '',
    operating_hours: '',
    contact_details: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchClinics = async () => {
    try {
      setIsLoading(true);
      const data = await clinicApi.getAllForAdmin();
      setClinics(data as unknown as Clinic[]);
    } catch (error) {
      console.error('Failed to fetch clinics:', error);
      Alert.alert('Error', 'Failed to load clinics');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchClinics();
    }, [])
  );

  const filteredClinics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return clinics.filter((clinic) => {
      if (!matchesStatus(clinic.status, statusFilter)) return false;
      if (!q) return true;
      return (
        (clinic.clinic_name || '').toLowerCase().includes(q) ||
        (clinic.location || '').toLowerCase().includes(q)
      );
    });
  }, [clinics, searchQuery, statusFilter]);

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'active';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('active');
  };

  const handleEdit = (clinic: Clinic) => {
    setEditingClinic(clinic);
    setForm({
      clinic_name: clinic.clinic_name,
      location: clinic.location,
      operating_hours: clinic.operating_hours,
      contact_details: clinic.contact_details,
    });
    setModalVisible(true);
  };

  const handleDelete = (clinicId: string, clinic_name: string) => {
    Alert.alert(
      'Delete Clinic',
      `Are you sure you want to delete ${clinic_name}? It will be hidden from patients but its history (past appointments/records) is kept. Clinics with active appointments can't be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await clinicApi.delete(clinicId);
              await fetchClinics();
              Alert.alert('Success', 'Clinic deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete clinic');
            }
          },
        },
      ]
    );
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.clinic_name.trim()) errors.clinic_name = 'Clinic name is required';
    if (!form.location.trim()) errors.location = 'Location is required';
    if (!form.operating_hours.trim()) errors.operating_hours = 'Operating hours are required';
    if (!form.contact_details.trim()) errors.contact_details = 'Contact details are required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      if (editingClinic) {
        await clinicApi.update(editingClinic.id, {
          clinic_name: form.clinic_name,
          location: form.location,
          operating_hours: form.operating_hours,
          contact_details: form.contact_details,
        });
      } else {
        await clinicApi.create({
          clinic_name: form.clinic_name,
          location: form.location,
          operating_hours: form.operating_hours,
          contact_details: form.contact_details,
        });
      }

      setModalVisible(false);
      setEditingClinic(null);
      setForm({ clinic_name: '', location: '', operating_hours: '', contact_details: '' });
      await fetchClinics();
      Alert.alert('Success', `Clinic ${editingClinic ? 'updated' : 'created'} successfully`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save clinic');
    }
  };

  const renderClinicCard = (clinic: Clinic) => (
    <View key={clinic.id} style={[styles.clinicCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.clinicHeader}>
        <View style={styles.clinicInfo}>
          <Text style={[styles.clinic_name, { color: theme.colors.text }]}>
            {clinic.clinic_name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: clinic.status === 'active' ? '#4CAF50' : '#9E9E9E' }]}>
            <Text style={styles.statusText}>
              {clinic.status === 'active' ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#4A90D9' }]}
            onPress={() => navigation.navigate('ClinicDetailsScreen', { clinicId: clinic.id })}
          >
            <Ionicons name="eye-outline" size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
            onPress={() => handleEdit(clinic)}
          >
            <Ionicons name="create-outline" size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#E53935' }]}
            onPress={() => handleDelete(clinic.id, clinic.clinic_name)}
          >
            <Ionicons name="trash-outline" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.clinicDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#666" />
          <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
            {clinic.location}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
            {clinic.operating_hours}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="call-outline" size={16} color="#666" />
          <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
            {clinic.contact_details}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={['#B08968', '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.15, 0.5]}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Clinic Management</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setEditingClinic(null);
              setForm({ clinic_name: '', location: '', operating_hours: '', contact_details: '' });
              setModalVisible(true);
            }}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clinics..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <StatusFilter value={statusFilter} onChange={setStatusFilter} />

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6B7C5C" />
            <Text style={styles.loadingText}>Loading clinics...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={fetchClinics} colors={['#6B7C5C']} />
            }
            showsVerticalScrollIndicator={false}
          >
            {filteredClinics.length > 0 ? (
              filteredClinics.map(renderClinicCard)
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={64} color="#CCC" />
                <Text style={styles.emptyTitle}>No clinics found</Text>
                <Text style={styles.emptyText}>
                  {hasActiveFilters
                    ? 'No clinics match the current filters'
                    : 'No clinics registered yet'}
                </Text>
                {hasActiveFilters && (
                  <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                    <Text style={styles.clearBtnText}>Clear filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {editingClinic ? 'Edit Clinic' : 'Add New Clinic'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <Input
                label="Clinic Name"
                value={form.clinic_name}
                onChangeText={(v) => setForm({ ...form, clinic_name: v })}
                error={formErrors.clinic_name}
              />
              <Input
                label="Location"
                value={form.location}
                onChangeText={(v) => setForm({ ...form, location: v })}
                error={formErrors.location}
                autoCapitalize="words"
              />
              <Input
                label="Operating Hours"
                value={form.operating_hours}
                onChangeText={(v) => setForm({ ...form, operating_hours: v })}
                error={formErrors.operating_hours}
                placeholder="e.g., Mon-Fri 07:30-16:30"
              />
              <Input
                label="Contact Details"
                value={form.contact_details}
                onChangeText={(v) => setForm({ ...form, contact_details: v })}
                error={formErrors.contact_details}
                placeholder="e.g., +27 21 123 4567"
              />

              <Button
                title={editingClinic ? 'Update Clinic' : 'Add Clinic'}
                onPress={handleSave}
                style={styles.modalButton}
              />
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  gradient: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  addButton: {
    backgroundColor: '#6B7C5C',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#333' },
  listContent: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  clinicCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  clinicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  clinicInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  clinic_name: { fontSize: 16, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: 6 },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clinicDetails: { gap: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 13 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 8 },
  clearBtn: {
    marginTop: 16,
    backgroundColor: '#6B7C5C',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  clearBtnText: { color: '#FFF', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '600' },
  modalButton: { marginTop: 8 },
});