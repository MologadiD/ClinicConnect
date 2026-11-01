import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { clinicApi } from '../../services/api/clinic';

interface ClinicDetailsData {
  id: string;
  clinicName: string;
  location: string;
  operatingHours: string;
  contactDetails: string;
  status: 'active' | 'inactive';
  services: Array<{
    id: string;
    serviceName: string;
    estimatedDuration: string;
  }>;
  staff: Array<{
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  }>;
  timeSlots: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  }>;
}

export default function ClinicDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const { clinicId } = route.params as { clinicId: string };

  const [clinic, setClinic] = useState<ClinicDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'services' | 'staff' | 'slots'>('details');

  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width >= 1024;

  const fetchClinicDetails = useCallback(async () => {
    try {
      const details = await clinicApi.getDetails(clinicId);

      setClinic({
        id: details.id,
        clinicName: details.clinic_name,
        location: details.location,
        operatingHours: details.operating_hours || '',
        contactDetails: details.contact_details || '',
        status: details.status,
        services: details.services.map((service: any) => ({
          id: service.id,
          serviceName: service.service_name,
          estimatedDuration: service.estimated_duration || '',
        })),
        staff: details.staff.map((member: any) => ({
          id: member.id,
          firstName: member.first_name,
          lastName: member.last_name,
          role: member.role,
        })),
        timeSlots: details.time_slots.map((slot: any) => ({
          id: slot.id,
          date: slot.date,
          startTime: slot.start_time,
          endTime: slot.end_time,
          isAvailable: slot.is_available,
        })),
      });
    } catch (error) {
      console.error('Failed to fetch clinic details:', error);
      Alert.alert('Error', 'Failed to load clinic details');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchClinicDetails();
  }, [fetchClinicDetails]);

  const handleCall = () => {
    if (clinic?.contactDetails) {
      Linking.openURL(`tel:${clinic.contactDetails.replace(/\s/g, '')}`);
    }
  };

  const handleLocation = () => {
    if (clinic?.location) {
      const encodedLocation = encodeURIComponent(clinic.location);
      Linking.openURL(`https://maps.google.com/maps?q=${encodedLocation}`);
    }
  };

  const renderDetailsTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.detailCard, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.detailCardTitle, { color: theme.colors.text }]}>
          Clinic Information
        </Text>

        <View style={styles.detailItem}>
          <Ionicons name="location-outline" size={20} color="#666" />
          <View style={styles.detailItemContent}>
            <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
              Location
            </Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
              {clinic?.location}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLocation} style={styles.detailAction}>
            <Ionicons name="navigate-outline" size={20} color="#4A90D9" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={20} color="#666" />
          <View style={styles.detailItemContent}>
            <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
              Operating Hours
            </Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
              {clinic?.operatingHours}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailItem}>
          <Ionicons name="call-outline" size={20} color="#666" />
          <View style={styles.detailItemContent}>
            <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
              Contact Details
            </Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
              {clinic?.contactDetails}
            </Text>
          </View>
          <TouchableOpacity onPress={handleCall} style={styles.detailAction}>
            <Ionicons name="call-outline" size={20} color="#4CAF50" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailItem}>
          <Ionicons name="information-circle-outline" size={20} color="#666" />
          <View style={styles.detailItemContent}>
            <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
              Status
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: clinic?.status === 'active' ? '#4CAF50' : '#9E9E9E' },
              ]}
            >
              <Text style={styles.statusText}>
                {clinic?.status === 'active' ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderServicesTab = () => (
    <View style={styles.tabContent}>
      {clinic?.services && clinic.services.length > 0 ? (
        clinic.services.map((service) => (
          <View key={service.id} style={[styles.serviceCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.serviceHeader}>
              <Text style={[styles.serviceName, { color: theme.colors.text }]}>
                {service.serviceName}
              </Text>
              <Text style={[styles.serviceDuration, { color: theme.colors.textSecondary }]}>
                {service.estimatedDuration || 'Duration not set'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigation.navigate('ServiceDetails', { serviceId: service.id })}
            >
              <Text style={styles.viewButtonText}>View Details</Text>
              <Ionicons name="arrow-forward" size={16} color="#6B7C5C" />
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="medkit-outline" size={48} color="#CCC" />
          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
            No services available at this clinic
          </Text>
        </View>
      )}
    </View>
  );

  const renderStaffTab = () => (
    <View style={styles.tabContent}>
      {clinic?.staff && clinic.staff.length > 0 ? (
        clinic.staff.map((staffMember) => (
          <View
            key={staffMember.id}
            style={[styles.staffCard, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.staffAvatar}>
              <Text style={styles.staffInitials}>
                {staffMember.firstName[0]}
                {staffMember.lastName[0]}
              </Text>
            </View>
            <View style={styles.staffInfo}>
              <Text style={[styles.staffName, { color: theme.colors.text }]}>
                {staffMember.firstName} {staffMember.lastName}
              </Text>
              <Text style={[styles.staffRole, { color: theme.colors.textSecondary }]}>
                {staffMember.role}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewStaffButton}
              onPress={() => navigation.navigate('StaffDetails', { staffId: staffMember.id })}
            >
              <Ionicons name="chevron-forward" size={20} color="#6B7C5C" />
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color="#CCC" />
          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
            No staff assigned to this clinic
          </Text>
        </View>
      )}
    </View>
  );

  const renderSlotsTab = () => (
    <View style={styles.tabContent}>
      {clinic?.timeSlots && clinic.timeSlots.length > 0 ? (
        clinic.timeSlots.map((slot) => (
          <View key={slot.id} style={[styles.slotCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.slotHeader}>
              <Text style={[styles.slotDate, { color: theme.colors.text }]}>
                {new Date(slot.date).toLocaleDateString('en-ZA', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <View
                style={[
                  styles.slotStatus,
                  { backgroundColor: slot.isAvailable ? '#4CAF50' : '#9E9E9E' },
                ]}
              >
                <Text style={styles.slotStatusText}>
                  {slot.isAvailable ? 'Available' : 'Booked'}
                </Text>
              </View>
            </View>
            <Text style={[styles.slotTime, { color: theme.colors.textSecondary }]}>
              {slot.startTime} - {slot.endTime}
            </Text>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color="#CCC" />
          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
            No time slots available for this clinic
          </Text>
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B7C5C" />
          <Text style={styles.loadingText}>Loading clinic details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={['#B08968', '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.15, 0.5]}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchClinicDetails} colors={['#6B7C5C']} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{clinic?.clinicName}</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={[styles.overviewCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.overviewStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                  {clinic?.services.length || 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Services</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                  {clinic?.staff.length || 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Staff</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                  {clinic?.timeSlots.filter((slot) => slot.isAvailable).length || 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Available Slots</Text>
              </View>
            </View>
          </View>

          <View style={styles.tabsContainer}>
            {(['details', 'services', 'staff', 'slots'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'details' && renderDetailsTab()}
          {activeTab === 'services' && renderServicesTab()}
          {activeTab === 'staff' && renderStaffTab()}
          {activeTab === 'slots' && renderSlotsTab()}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    textAlign: 'center',
  },
  overviewCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#E0E0E0' },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: { fontSize: 13, color: '#666', fontWeight: '500' },
  tabTextActive: { color: '#1a1a1a' },
  tabContent: { flex: 1 },
  detailCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailCardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  detailItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  detailItemContent: { flex: 1, marginLeft: 12 },
  detailLabel: { fontSize: 11 },
  detailValue: { fontSize: 14, fontWeight: '500' },
  detailAction: { padding: 4 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  serviceCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceHeader: { flex: 1 },
  serviceName: { fontSize: 14, fontWeight: '500' },
  serviceDuration: { fontSize: 12, marginTop: 2 },
  viewButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewButtonText: { fontSize: 13, color: '#6B7C5C', fontWeight: '500' },
  staffCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6B7C5C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffInitials: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  staffInfo: { flex: 1, marginLeft: 12 },
  staffName: { fontSize: 14, fontWeight: '500' },
  staffRole: { fontSize: 12 },
  viewStaffButton: { padding: 4 },
  slotCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slotDate: { fontSize: 14, fontWeight: '500' },
  slotStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  slotStatusText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
  slotTime: { fontSize: 13 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyStateText: { fontSize: 14, marginTop: 8 },
});