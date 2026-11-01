import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../services/supabase/client';
import { HealthTip } from '../../types';

const FALLBACK_TIPS: HealthTip[] = [
  {
    id: '1',
    title: 'Stay hydrated',
    content: 'Drink at least 6–8 glasses of clean water every day, especially in warm weather.',
    category: 'General',
    featured: true,
  },
  {
    id: '2',
    title: 'Wash your hands',
    content: 'Wash hands with soap for 20 seconds before eating and after using the toilet to prevent infections.',
    category: 'Hygiene',
  },
  {
    id: '3',
    title: 'Know your BP',
    content: 'Have your blood pressure checked regularly. High BP often has no symptoms but can lead to serious illness.',
    category: 'Chronic care',
  },
  {
    id: '4',
    title: 'Take medication on time',
    content: 'If you are on chronic medication (e.g. for HIV, diabetes, hypertension), take it at the same time every day.',
    category: 'Medication',
  },
  {
    id: '5',
    title: 'When to seek urgent care',
    content: 'Chest pain, difficulty breathing, severe bleeding, or sudden weakness need immediate medical attention — use the Emergency button.',
    category: 'Emergency',
  },
];

export default function HealthTipsScreen() {
  const navigation = useNavigation();
  const [tips, setTips] = useState<HealthTip[]>(FALLBACK_TIPS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('health_tips')
        .select('*')
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        setTips(data as HealthTip[]);
      }
    } catch {
      // keep fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#212121" />
        </TouchableOpacity>
        <Text style={styles.title}>Health Tips</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#2E7D32" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={['#2E7D32']} />
          }
          renderItem={({ item }) => {
            const isOpen = expanded === item.id;
            return (
              <TouchableOpacity
                style={[styles.card, item.featured && styles.featured]}
                onPress={() => setExpanded(isOpen ? null : item.id)}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    {item.category ? (
                      <Text style={styles.category}>{item.category}</Text>
                    ) : null}
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#757575"
                  />
                </View>
                {isOpen && <Text style={styles.content}>{item.content}</Text>}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7F5' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  back: { padding: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', marginLeft: 4 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  featured: { borderLeftWidth: 4, borderLeftColor: '#2E7D32' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  category: { fontSize: 11, color: '#2E7D32', fontWeight: '600', marginBottom: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#212121' },
  content: { marginTop: 10, fontSize: 14, color: '#616161', lineHeight: 20 },
});
