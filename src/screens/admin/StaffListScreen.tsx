// src/screens/admin/StaffListScreen.tsx
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabase/client';
import { RootStackParamList } from '../../navigation/types';
type StatusFilterValue = 'all' | 'active' | 'inactive';

const matchesStatus = (status: string, filter: StatusFilterValue) =>
  filter === 'all' || status === filter;

function StatusFilter({
  value,
  onChange,
}: {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}) {
  const options: { value: StatusFilterValue; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'all', label: 'All status' },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: selected ? '#6B7C5C' : '#FFF',
              borderWidth: 1,
              borderColor: selected ? '#6B7C5C' : '#E0E0E0',
            }}
          >
            <Text style={{ color: selected ? '#FFF' : '#555', fontSize: 13, fontWeight: '600' }}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  contact_number?: string | null;
  role: string;
  clinic_id?: string | null;
  staff_reg_number: string;
  status: 'active' | 'inactive';
  clinicName?: string;
}

type RoleFilter = 'all' | 'Doctor' | 'Nurse' | 'Admin' | 'FirstResponder';

const ROLE_COLORS: Record<string, string> = {
  Doctor: '#2196F3',
  Nurse: '#4CAF50',
  Admin: '#FF9800',
  FirstResponder: '#E53935',
};

const ROLE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Doctor: 'medical-outline',
  Nurse: 'medkit-outline',
  Admin: 'shield-outline',
  FirstResponder: 'alert-circle-outline',
};

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'all', label: 'All roles' },
  { id: 'Doctor', label: 'Doctors' },
  { id: 'Nurse', label: 'Nurses' },
  { id: 'Admin', label: 'Admins' },
  { id: 'FirstResponder', label: 'Responders' },
];

export default function StaffListScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('active');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch is independent of the filters, so typing / tapping chips never re-queries.
  const fetchStaff = useCallback(async () => {
    try {
      setErrorMessage(null);
      const { data, error } = await supabase
        .from('staff')
        .select(
          `
          id,
          first_name,
          last_name,
          email,
          contact_number,
          role,
          clinic_id,
          staff_reg_number,
          status,
          clinics ( clinic_name )
        `
        )
        .order('first_name', { ascending: true });

      if (error) throw error;

      const formatted: StaffMember[] = (data || []).map((item: any) => ({
        id: item.id,
        first_name: item.first_name || '',
        last_name: item.last_name || '',
        email: item.email || '',
        contact_number: item.contact_number,
        role: item.role || '',
        clinic_id: item.clinic_id,
        staff_reg_number: item.staff_reg_number || '',
        status: item.status === 'inactive' ? 'inactive' : 'active',
        clinicName:
          item.clinics?.clinic_name ||
          item.clinics?.[0]?.clinic_name ||
          'Unassigned',
      }));

      setStaff(formatted);
    } catch (error: any) {
      console.error('Failed to fetch staff:', error);
      setErrorMessage(error.message || 'Failed to load staff members');
      setStaff([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchStaff();
    }, [fetchStaff])
  );

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return staff.filter((s) => {
      if (!matchesStatus(s.status, statusFilter)) return false;
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;

      if (q) {
        const name = `${s.first_name} ${s.last_name}`.toLowerCase();
        return (
          name.includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.staff_reg_number.toLowerCase().includes(q) ||
          (s.contact_number || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [staff, searchQuery, roleFilter, statusFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'active';

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('active');
  };

  const handleDeactivate = (member: StaffMember) => {
    const isActive = member.status === 'active';
    Alert.alert(
      isActive ? 'Deactivate staff' : 'Reactivate staff',
      isActive
        ? `Deactivate ${member.first_name} ${member.last_name}? They will no longer be able to sign in as staff.`
        : `Reactivate ${member.first_name} ${member.last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isActive ? 'Deactivate' : 'Reactivate',
          style: isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('staff')
                .update({
                  status: isActive ? 'inactive' : 'active',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', member.id);

              if (error) throw error;
              await fetchStaff();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not update staff status');
            }
          },
        },
      ]
    );
  };

  const renderStaffCard = (member: StaffMember) => {
    const color = ROLE_COLORS[member.role] || '#6B7C5C';
    const icon = ROLE_ICONS[member.role] || 'person-outline';

    return (
      <TouchableOpacity
        key={member.id}
        style={[styles.staffCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => navigation.navigate('StaffDetails', { staffId: member.id })}
        activeOpacity={0.85}
      >
        <View style={styles.staffHeader}>
          <View style={[styles.avatar, { backgroundColor: color + '22' }]}>
            <Text style={[styles.avatarText, { color }]}>
              {(member.first_name?.[0] || '?') + (member.last_name?.[0] || '')}
            </Text>
          </View>
          <View style={styles.staffInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.staffName, { color: theme.colors.text }]} numberOfLines={1}>
                {member.first_name} {member.last_name}
              </Text>
              <View style={[styles.roleBadge, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={12} color={color} />
                <Text style={[styles.roleText, { color }]}>{member.role}</Text>
              </View>
            </View>
            <Text style={[styles.staffId, { color: theme.colors.textSecondary }]}>
              {member.staff_reg_number}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDeactivate(member)}
            style={styles.actionButton}
            hitSlop={8}
          >
            <Ionicons
              name={member.status === 'active' ? 'person-remove-outline' : 'person-add-outline'}
              size={20}
              color={member.status === 'active' ? '#E53935' : '#4CAF50'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.staffDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={14} color="#888" />
            <Text style={[styles.detailText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {member.email || '—'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={14} color="#888" />
            <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
              {member.contact_number || 'N/A'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="business-outline" size={14} color="#888" />
            <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
              {member.clinicName || 'Unassigned'}
            </Text>
          </View>
        </View>

        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: member.status === 'active' ? '#4CAF50' : '#9E9E9E' },
            ]}
          />
          <Text
            style={{
              color: member.status === 'active' ? '#4CAF50' : '#9E9E9E',
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            {member.status === 'active' ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={['#B08968', '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.15, 0.5]}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Staff Management</Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
              {filteredStaff.length} of {staff.length} shown
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddStaff')}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, email, staff ID..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
            autoCapitalize="none"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <StatusFilter value={statusFilter} onChange={setStatusFilter} />

        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            {ROLE_FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterChip,
                  roleFilter === filter.id && styles.filterChipActive,
                ]}
                onPress={() => setRoleFilter(filter.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    roleFilter === filter.id && styles.filterChipTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6B7C5C" />
            <Text style={styles.loadingText}>Loading staff...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.emptyState}>
            <Ionicons name="warning-outline" size={40} color="#E53935" />
            <Text style={styles.emptyText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchStaff}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchStaff();
                }}
                colors={['#6B7C5C']}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {filteredStaff.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={40} color="#BDBDBD" />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  {hasActiveFilters
                    ? 'No staff match the current filters'
                    : 'No staff members found'}
                </Text>
                {hasActiveFilters ? (
                  <TouchableOpacity style={styles.retryBtn} onPress={clearFilters}>
                    <Text style={styles.retryText}>Clear filters</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => navigation.navigate('AddStaff')}
                  >
                    <Text style={styles.retryText}>Add staff</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filteredStaff.map(renderStaffCard)
            )}
          </ScrollView>
        )}
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#6B7C5C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    borderRadius: 24,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 10,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: '#333',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipActive: {
    backgroundColor: '#6B7C5C',
    borderColor: '#6B7C5C',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  staffCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  staffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontWeight: '700',
    fontSize: 14,
  },
  staffInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  staffName: {
    fontSize: 15,
    fontWeight: '700',
    maxWidth: '60%',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  staffId: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButton: {
    padding: 6,
  },
  staffDetails: {
    gap: 6,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#6B7C5C',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '600',
  },
});