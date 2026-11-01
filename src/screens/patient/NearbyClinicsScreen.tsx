import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import OsmMap, { OsmMarker } from '../../components/OsmMap';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../context/ThemeContext';
import { clinicApi, Clinic } from '../../services/api/clinic';
import { getBestLocation, calculateDistance, CAPE_TOWN_COORDINATES } from '../../utils/location';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface ClinicWithDistance extends Clinic {
  distanceKm?: number;
}

export default function NearbyClinicsScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const [clinics, setClinics] = useState<ClinicWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [userLoc, setUserLoc] = useState(CAPE_TOWN_COORDINATES);
  const [showMap, setShowMap] = useState(Platform.OS !== 'web');

  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width >= 1024;

  const load = useCallback(async () => {
    try {
      const loc = await getBestLocation();
      setUserLoc(loc);
      const data = await clinicApi.getAll();
      const withDist = data.map((c) => {
        if (c.latitude && c.longitude) {
          return {
            ...c,
            distanceKm: calculateDistance(
              loc.latitude,
              loc.longitude,
              c.latitude,
              c.longitude
            ),
          };
        }
        return c;
      });
      withDist.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
      setClinics(withDist);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return clinics;
    const q = query.toLowerCase();
    return clinics.filter(
      (c) =>
        c.clinic_name.toLowerCase().includes(q) ||
        (c.location || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
    );
  }, [clinics, query]);

  const mapMarkers = useMemo<OsmMarker[]>(
    () =>
      filtered
        .filter((c) => c.latitude && c.longitude)
        .map((c) => ({
          id: String(c.id),
          title: c.clinic_name,
          subtitle: c.distanceKm != null ? `${c.distanceKm} km away` : undefined,
          latitude: c.latitude!,
          longitude: c.longitude!,
        })),
    [filtered]
  );

  const renderClinic = ({ item, index }: { item: ClinicWithDistance; index: number }) => (
    <TouchableOpacity
      style={[
        styles.clinicRow,
        index === filtered.length - 1 && styles.clinicRowLast,
        { backgroundColor: theme.colors.surface },
      ]}
      onPress={() => navigation.navigate('ClinicDetails', { clinicId: item.id })}
      activeOpacity={0.85}
    >
      <View style={[styles.clinicIcon, { backgroundColor: '#6B7C5C15' }]}>
        <Ionicons name="medical-outline" size={22} color="#6B7C5C" />
      </View>
      <View style={styles.clinicInfo}>
        <Text style={[styles.clinicName, { color: theme.colors.text }]} numberOfLines={1}>
          {item.clinic_name}
        </Text>
        <Text style={[styles.clinicMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {item.location || item.address || 'Cape Town'}
        </Text>
        {item.distanceKm != null && (
          <View style={styles.distanceRow}>
            <Ionicons name="navigate-outline" size={12} color="#6B7C5C" />
            <Text style={styles.distanceText}>{item.distanceKm} km away</Text>
          </View>
        )}
      </View>
      <TouchableOpacity
        style={styles.bookChip}
        onPress={() =>
          navigation.navigate('SelectService', {
            clinicId: item.id,
            clinicName: item.clinic_name,
          })
        }
      >
        <Text style={styles.bookChipText}>Book</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={['#B08968', '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.18, 0.5]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Nearby Clinics
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
              Find and book at clinics near you
            </Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowMap((v) => !v)}
            accessibilityLabel={showMap ? 'Show list only' : 'Show map'}
          >
            <Ionicons
              name={showMap ? 'list-outline' : 'map-outline'}
              size={22}
              color="#6B7C5C"
            />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clinics by name or area..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#BDBDBD" />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6B7C5C" />
            <Text style={styles.loadingText}>Finding clinics near you...</Text>
          </View>
        ) : (
          <>
            {/* Map */}
            {showMap && !isWeb && (
              <View style={styles.mapWrapper}>
                <OsmMap
                  center={userLoc}
                  markers={mapMarkers}
                  height={180}
                  onMarkerPress={(id) => navigation.navigate('ClinicDetails', { clinicId: id })}
                />
              </View>
            )}

            {/* Results label */}
            <View style={styles.resultsHeader}>
              <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
                {filtered.length} CLINIC{filtered.length === 1 ? '' : 'S'} FOUND
              </Text>
            </View>

            {/* List card */}
            <View
              style={[
                styles.listCard,
                { backgroundColor: theme.colors.surface },
                isDesktop && styles.listCardDesktop,
              ]}
            >
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={renderClinic}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={['#6B7C5C']}
                  />
                }
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Ionicons name="business-outline" size={40} color="#BDBDBD" />
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                      {query ? 'No clinics match your search' : 'No clinics available'}
                    </Text>
                    {query.length > 0 && (
                      <TouchableOpacity onPress={() => setQuery('')}>
                        <Text style={styles.clearSearch}>Clear search</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                }
              />
            </View>
          </>
        )}
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    borderRadius: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
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
  mapWrapper: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 12,
  },
  map: {
    height: 180,
    width: '100%',
  },
  resultsHeader: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  listCard: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  listCardDesktop: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  listContent: {
    paddingVertical: 4,
    flexGrow: 1,
  },
  clinicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  clinicRowLast: {
    borderBottomWidth: 0,
  },
  clinicIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clinicInfo: {
    flex: 1,
  },
  clinicName: {
    fontSize: 15,
    fontWeight: '600',
  },
  clinicMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7C5C',
  },
  bookChip: {
    backgroundColor: '#6B7C5C',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bookChipText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  clearSearch: {
    marginTop: 12,
    color: '#6B7C5C',
    fontWeight: '600',
    fontSize: 14,
  },
});