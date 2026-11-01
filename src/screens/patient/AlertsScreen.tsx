import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase/client';
import { EmergencyAlert, EmergencyStatus, Priority } from '../../types';

const STATUS_META: Record<
  EmergencyStatus,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: { label: 'Pending', color: '#E53935', icon: 'alert-circle' },
  dispatched: { label: 'Responder Dispatched', color: '#FF9800', icon: 'car' },
  resolved: { label: 'Resolved', color: '#4CAF50', icon: 'checkmark-circle' },
  cancelled: { label: 'Cancelled', color: '#9E9E9E', icon: 'close-circle' },
};

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  low: { label: 'Low', color: '#4CAF50' },
  medium: { label: 'Medium', color: '#FF9800' },
  high: { label: 'High', color: '#FB8C00' },
  critical: { label: 'Critical', color: '#E53935' },
};

function formatDateTime(iso?: string) {
  if (!iso) return 'Unknown time';
  const date = new Date(iso);
  return date.toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLocationAddress(location: EmergencyAlert['location']): string {
  if (!location) return '';
  if (typeof location === 'string') return location;
  const loc = location as Record<string, unknown>;
  if (typeof loc.address === 'string' && loc.address.trim()) return loc.address;
  if (typeof loc.label === 'string' && loc.label.trim()) return loc.label;
  return '';
}

export default function AlertsScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { profile } = useAuth();

  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!profile?.id) {
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setErrorMessage(null);
      const { data, error } = await supabase
        .from('emergency_alerts')
        .select('*')
        .eq('patient_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAlerts(data || []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      setErrorMessage('Failed to load your alerts. Pull down to try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchAlerts();
    }, [fetchAlerts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAlerts();
  };

  const toggleExpanded = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  const callEmergencyServices = () => {
    Linking.openURL('tel:10177');
  };

  const renderAlert = (alert: EmergencyAlert) => {
    const statusMeta = STATUS_META[alert.emergency_status];
    const priorityMeta = PRIORITY_META[alert.priority];
    const isExpanded = expandedId === alert.id;
    const locationAddress = getLocationAddress(alert.location);

    return (
      <TouchableOpacity
        key={alert.id}
        style={[
          styles.alertCard,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        ]}
        onPress={() => toggleExpanded(alert.id)}
        activeOpacity={0.8}
      >
        <View style={styles.alertHeader}>
          <View style={styles.alertHeaderLeft}>
            <Ionicons name={statusMeta.icon} size={20} color={statusMeta.color} />
            <Text style={[styles.alertStatus, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: priorityMeta.color }]}>
            <Text style={styles.priorityText}>{priorityMeta.label}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
            {formatDateTime(alert.created_at)}
          </Text>
        </View>

        {locationAddress ? (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
            <Text
              style={[styles.detailText, { color: theme.colors.textSecondary }]}
              numberOfLines={isExpanded ? undefined : 1}
            >
              {locationAddress}
            </Text>
          </View>
        ) : null}

        {alert.description ? (
          <Text
            style={[styles.description, { color: theme.colors.text }]}
            numberOfLines={isExpanded ? undefined : 2}
          >
            {alert.description}
          </Text>
        ) : null}

        {isExpanded && (
          <View style={[styles.expandedSection, { borderTopColor: theme.colors.border }]}>
            {alert.notes ? (
              <View style={styles.expandedRow}>
                <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>
                  Responder notes
                </Text>
                <Text style={[styles.expandedValue, { color: theme.colors.text }]}>{alert.notes}</Text>
              </View>
            ) : null}

            {alert.resolved_at ? (
              <View style={styles.expandedRow}>
                <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>
                  Resolved at
                </Text>
                <Text style={[styles.expandedValue, { color: theme.colors.text }]}>
                  {formatDateTime(alert.resolved_at)}
                </Text>
              </View>
            ) : null}

            {alert.emergency_status === 'pending' && (
              <TouchableOpacity style={styles.callButton} onPress={callEmergencyServices}>
                <Ionicons name="call" size={16} color="#FFF" />
                <Text style={styles.callButtonText}>Call Emergency Services</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.textSecondary}
          style={styles.chevron}
        />
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
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alerts</Text>
          <View style={styles.backButton} />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6B7C5C" />
            <Text style={styles.loadingText}>Loading your alerts...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6B7C5C']} />
            }
          >
            {errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="warning-outline" size={16} color={theme.colors.error} />
                <Text style={[styles.errorBannerText, { color: theme.colors.error }]}>{errorMessage}</Text>
              </View>
            )}

            {alerts.length === 0 && !errorMessage ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="shield-checkmark-outline" size={64} color="#CCC" />
                <Text style={styles.emptyTitle}>No alerts yet</Text>
                <Text style={styles.emptyText}>
                  Any emergency alerts you send will show up here, along with their status.
                </Text>
              </View>
            ) : (
              alerts.map(renderAlert)
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 8, width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  listContent: { padding: 16, flexGrow: 1 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: { fontSize: 13, flex: 1 },
  alertCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertStatus: { fontSize: 15, fontWeight: '600' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  priorityText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  detailText: { fontSize: 13, flex: 1 },
  description: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  expandedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, gap: 8 },
  expandedRow: { gap: 2 },
  expandedLabel: { fontSize: 11, textTransform: 'uppercase', fontWeight: '600' },
  expandedValue: { fontSize: 14 },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E53935',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 4,
  },
  callButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  chevron: { alignSelf: 'center', marginTop: 8 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
});