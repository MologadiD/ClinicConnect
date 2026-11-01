import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase/client';

interface DashboardStats {
  totalStaff: number;
  totalClinics: number;
  totalServices: number;
  totalAppointments: number;
  activeEmergencies: number;
  pendingStaffRequests: number;
}

interface RecentActivity {
  id: string;
  type: 'staff_added' | 'clinic_updated' | 'appointment' | 'emergency';
  description: string;
  timestamp: string;
}

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { logout } = useAuth();
  const { width } = useWindowDimensions();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width >= 1024;

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);

      // Fetch stats using Supabase
      const [
        { count: totalStaff },
        { count: totalClinics },
        { count: totalServices },
        { count: totalAppointments }
      ] = await Promise.all([
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('services').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        totalStaff: totalStaff || 0,
        totalClinics: totalClinics || 0,
        totalServices: totalServices || 0,
        totalAppointments: totalAppointments || 0,
        activeEmergencies: 0,
        pendingStaffRequests: 0,
      });

      // Fetch recent activities
      const { data: recentAppointments } = await supabase
        .from('appointments')
        .select(`
          id,
          status,
          created_at,
          patients:patient_id (first_name, last_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentAppointments) {
        const formattedActivities: RecentActivity[] = recentAppointments.map((app: any) => {
          const patientName = app.patients 
            ? `${app.patients.first_name || ''} ${app.patients.last_name || ''}`.trim() 
            : 'Unknown Patient';
          return {
            id: app.id,
            type: 'appointment',
            description: `Appointment ${app.status || 'created'} for ${patientName || 'Unknown'}`,
            timestamp: app.created_at,
          };
        });
        setActivities(formattedActivities);
      }

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, []);

  const statCards = stats
    ? [
        { label: 'Staff', value: stats.totalStaff, icon: 'people-outline', color: '#4A90D9' },
        { label: 'Clinics', value: stats.totalClinics, icon: 'business-outline', color: '#6B7C5C' },
        { label: 'Services', value: stats.totalServices, icon: 'medkit-outline', color: '#FF9800' },
        { label: 'Appointments', value: stats.totalAppointments, icon: 'calendar-outline', color: '#9C27B0' },
        { label: 'Emergencies', value: stats.activeEmergencies, icon: 'warning-outline', color: '#E53935' },
        { label: 'Pending', value: stats.pendingStaffRequests, icon: 'time-outline', color: '#FF6F00' },
      ]
    : [];

  const menuItems = [
    { id: 'staff', label: 'Staff Management', icon: 'people-outline', color: '#4A90D9', route: 'StaffList' },
    { id: 'clinics', label: 'Clinic Management', icon: 'business-outline', color: '#6B7C5C', route: 'ClinicManagement' },
    { id: 'services', label: 'Service Management', icon: 'medkit-outline', color: '#FF9800', route: 'ServiceManagement' },
    { id: 'timeslots', label: 'Time Slot Management', icon: 'time-outline', color: '#9C27B0', route: 'TimeSlotManagement' },
    { id: 'addStaff', label: 'Add Staff', icon: 'person-add-outline', color: '#2E7D32', route: 'AddStaff' },
  ];

  const renderStatCard = (stat: typeof statCards[0]) => (
    <View key={stat.label} style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
      <View style={[styles.statIconContainer, { backgroundColor: stat.color + '20' }]}>
        <Ionicons name={stat.icon as any} size={24} color={stat.color} />
      </View>
      <Text style={[styles.statValue, { color: theme.colors.text }]}>{stat.value}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{stat.label}</Text>
    </View>
  );

  const renderMenuGrid = () => {
    const columns = isDesktop ? 4 : 2;
    return menuItems.map((item) => (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.menuCard,
          { backgroundColor: theme.colors.surface, width: `${(100 / columns) - 2}%` },
        ]}
        onPress={() => navigation.navigate(item.route as any)}
      >
        <View style={[styles.menuIconContainer, { backgroundColor: item.color + '15' }]}>
          <Ionicons name={item.icon as any} size={32} color={item.color} />
        </View>
        <Text style={[styles.menuLabel, { color: theme.colors.text }]}>{item.label}</Text>
      </TouchableOpacity>
    ));
  };

  const renderActivityItem = (activity: RecentActivity) => {
    const icons: Record<string, string> = {
      staff_added: 'person-add-outline',
      clinic_updated: 'business-outline',
      appointment: 'calendar-outline',
      emergency: 'warning-outline',
    };

    const colors: Record<string, string> = {
      staff_added: '#4A90D9',
      clinic_updated: '#6B7C5C',
      appointment: '#9C27B0',
      emergency: '#E53935',
    };

    return (
      <View key={activity.id} style={styles.activityItem}>
        <View style={[styles.activityIcon, { backgroundColor: colors[activity.type] + '20' }]}>
          <Ionicons name={icons[activity.type] as any} size={16} color={colors[activity.type]} />
        </View>
        <View style={styles.activityContent}>
          <Text style={[styles.activityDescription, { color: theme.colors.text }]}>
            {activity.description}
          </Text>
          <Text style={[styles.activityTimestamp, { color: theme.colors.textSecondary }]}>
            {new Date(activity.timestamp).toLocaleString()}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B7C5C" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6B7C5C']} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                  Admin Dashboard
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
                  Manage your healthcare system
                </Text>
              </View>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
                accessibilityLabel="Sign out"
              >
                <Ionicons name="log-out-outline" size={22} color="#E53935" />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsGrid}>
            {statCards.map(renderStatCard)}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Quick Actions
          </Text>
          <View style={styles.menuGrid}>
            {renderMenuGrid()}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Recent Activity
          </Text>
          <View style={[styles.activityContainer, { backgroundColor: theme.colors.surface }]}>
            {activities.length > 0 ? (
              activities.map(renderActivityItem)
            ) : (
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No recent activity
              </Text>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E53935',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    width: '30%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  menuCard: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  activityContainer: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 13,
  },
  activityTimestamp: {
    fontSize: 11,
    marginTop: 2,
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
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
});