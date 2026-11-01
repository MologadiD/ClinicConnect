// src/components/StatusFilter.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export type StatusFilterValue = 'active' | 'inactive' | 'all';

const OPTIONS: { id: StatusFilterValue; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'all', label: 'All' },
];

/** Shared rule so every admin list filters status the same way. */
export function matchesStatus(
  status: string | null | undefined,
  filter: StatusFilterValue
): boolean {
  if (filter === 'all') return true;
  const normalised = status === 'inactive' ? 'inactive' : 'active';
  return normalised === filter;
}

interface Props {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}

export function StatusFilter({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.segment, selected && styles.segmentActive]}
            onPress={() => onChange(opt.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.text, selected && styles.textActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 3,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#6B7C5C',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  textActive: {
    color: '#FFF',
  },
});