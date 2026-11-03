import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import {
  referralsApi,
  Referral,
  ReferralStatus,
  ReferralUrgency,
  SPECIALIST_TYPES,
  CreateReferralInput,
} from '../../services/api/referrals';
import { shareOrDownloadPdf, shareOrDownloadText } from '../../utils/shareText';
import { notify } from '../../utils/dialogs';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_CHIP: Record<
  ReferralStatus,
  { label: string; bg: string; fg: string }
> = {
  pending: { label: 'Pending', bg: '#FFF3E0', fg: '#E65100' },
  accepted: { label: 'Accepted', bg: '#E3F2FD', fg: '#1565C0' },
  scheduled: { label: 'Scheduled', bg: '#E8F5E9', fg: '#2E7D32' },
  completed: { label: 'Completed', bg: '#F3E5F5', fg: '#7B1FA2' },
  cancelled: { label: 'Cancelled', bg: '#FFEBEE', fg: '#C62828' },
};

const URGENCY_COLOR: Record<ReferralUrgency, string> = {
  routine: '#2d7a4f',
  urgent: '#e6a817',
  emergency: '#C62828',
};

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ReferralScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const { role, profile } = useAuth();

  const patientIdParam: string | undefined = route.params?.patientId;
  const referralIdParam: string | undefined = route.params?.referralId;
  const mode: 'list' | 'create' = route.params?.mode === 'create' ? 'create' : 'list';

  const isDoctor = role === 'Doctor';
  /** Doctors and nurses may issue referrals */
  const canRefer = role === 'Doctor' || role === 'Nurse';

  const patientId =
    patientIdParam || (role === 'patient' ? profile?.id : undefined);

  const [items, setItems] = useState<Referral[]>([]);
  const [selected, setSelected] = useState<Referral | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(mode === 'create' && canRefer);
  const [specialistType, setSpecialistType] =
    useState<(typeof SPECIALIST_TYPES)[number]>(SPECIALIST_TYPES[0]);
  const [specialistName, setSpecialistName] = useState('');
  const [reason, setReason] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [urgency, setUrgency] = useState<ReferralUrgency>('routine');

  const patientName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : undefined;

  const load = useCallback(async () => {
    try {
      setError(null);
      let rows: Referral[] = [];

      if (referralIdParam) {
        const one = await referralsApi.getById(referralIdParam);
        rows = one ? [one] : [];
        if (one) setSelected(one);
      } else if (patientId) {
        rows = await referralsApi.getByPatient(patientId);
      } else if (isDoctor && profile?.id) {
        rows = await referralsApi.getByDoctor(profile.id);
      }

      setItems(rows);
      if (rows.length === 1 && referralIdParam) {
        setSelected(rows[0]);
      }
    } catch (e: any) {
      console.error('Failed to load referrals:', e);
      setError(e?.message || 'Could not load referrals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId, referralIdParam, isDoctor, profile?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const download = async (ref: Referral) => {
    try {
      setBusy(true);
      const text = referralsApi.formatAsText(ref, patientName);
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
        body{font-family:-apple-system,sans-serif;padding:24px;color:#222;line-height:1.5}
        h1{color:#6B7C5C;font-size:18px;margin:0 0 8px}
        pre{white-space:pre-wrap;font-family:inherit;font-size:13px}
      </style></head><body>
        <h1>Clinic-Connect Specialist Referral</h1>
        <pre>${text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</pre>
      </body></html>`;

      try {
        await shareOrDownloadPdf(`referral-${ref.id.slice(0, 8)}.pdf`, html);
      } catch {
        await shareOrDownloadText(`referral-${ref.id.slice(0, 8)}.txt`, text);
      }
    } catch (e: any) {
      notify('Could not download', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitCreate = async () => {
    if (!patientId) {
      Alert.alert('Error', 'No patient selected.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Missing info', 'Please enter a reason for the referral.');
      return;
    }
    try {
      setBusy(true);
      const input: CreateReferralInput = {
        patient_id: patientId,
        referring_doctor_id: profile?.id,
        specialist_type: specialistType,
        specialist_name: specialistName.trim() || undefined,
        reason: reason.trim(),
        clinical_notes: clinicalNotes.trim() || undefined,
        urgency,
      };
      const created = await referralsApi.create(input);
      setShowCreate(false);
      setReason('');
      setClinicalNotes('');
      setSpecialistName('');
      setUrgency('routine');
      await load();
      setSelected(created);
      notify('Referral created', 'The referral has been issued.');
    } catch (e: any) {
      notify('Could not create referral', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (ref: Referral, status: ReferralStatus) => {
    try {
      setBusy(true);
      await referralsApi.updateStatus(ref.id, status);
      await load();
      if (selected?.id === ref.id) {
        setSelected({ ...ref, status });
      }
    } catch (e: any) {
      notify('Could not update', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6B7C5C" />
          <Text style={styles.muted}>Loading referrals…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Create form (Doctor + Nurse) ───────────────────────────────────
  if (showCreate && canRefer) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backRow} onPress={() => setShowCreate(false)}>
            <Ionicons name="arrow-back" size={22} color="#2D3A2B" />
            <Text style={styles.backLabel}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.title}>New specialist referral</Text>
          <Text style={styles.sub}>Issue a referral for this patient</Text>

          <Text style={styles.label}>Specialist type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {SPECIALIST_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, specialistType === t && styles.chipOn]}
                onPress={() => setSpecialistType(t)}
              >
                <Text style={[styles.chipText, specialistType === t && styles.chipTextOn]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Preferred specialist (optional)</Text>
          <TextInput
            style={styles.input}
            value={specialistName}
            onChangeText={setSpecialistName}
            placeholder="e.g. Dr A. Petersen"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Urgency</Text>
          <View style={styles.row}>
            {(['routine', 'urgent', 'emergency'] as ReferralUrgency[]).map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.chip, urgency === u && styles.chipOn]}
                onPress={() => setUrgency(u)}
              >
                <Text style={[styles.chipText, urgency === u && styles.chipTextOn]}>
                  {u.charAt(0).toUpperCase() + u.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Reason for referral *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={reason}
            onChangeText={setReason}
            placeholder="Clinical reason…"
            placeholderTextColor="#999"
            multiline
          />

          <Text style={styles.label}>Clinical notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={clinicalNotes}
            onChangeText={setClinicalNotes}
            placeholder="Additional notes for the specialist…"
            placeholderTextColor="#999"
            multiline
          />

          <TouchableOpacity
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={submitCreate}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Issue referral</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Detail ─────────────────────────────────────────────────────────
  if (selected) {
    const ref = selected;
    const chip = STATUS_CHIP[ref.status] || STATUS_CHIP.pending;
    const doctor = ref.referring_doctor
      ? `Dr ${ref.referring_doctor.first_name || ''} ${ref.referring_doctor.last_name || ''}`.trim()
      : 'Doctor';
    const clinic =
      ref.preferred_clinic?.clinic_name ||
      ref.specialist_name ||
      'Any suitable facility';

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6B7C5C']} />
          }
        >
          <TouchableOpacity style={styles.backRow} onPress={() => setSelected(null)}>
            <Ionicons name="arrow-back" size={22} color="#2D3A2B" />
            <Text style={styles.backLabel}>All referrals</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Specialist referral</Text>
          <Text style={styles.sub}>ID {ref.id.slice(0, 8).toUpperCase()}</Text>

          <View style={[styles.badge, { backgroundColor: chip.bg }]}>
            <Text style={[styles.badgeText, { color: chip.fg }]}>{chip.label}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>REFERRED TO</Text>
            <Text style={styles.big}>{ref.specialist_type}</Text>
            {ref.specialist_name ? (
              <Text style={styles.muted}>{ref.specialist_name}</Text>
            ) : null}
            <Text style={styles.muted}>{clinic}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>DETAILS</Text>
            <Row label="Referred by" value={doctor} />
            <Row label="Date issued" value={fmtDate(ref.referred_at || ref.created_at)} />
            <Row
              label="Urgency"
              value={ref.urgency.charAt(0).toUpperCase() + ref.urgency.slice(1)}
              valueColor={URGENCY_COLOR[ref.urgency]}
            />
            <Row label="Status" value={chip.label} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>REASON</Text>
            <Text style={styles.bodyText}>{ref.reason}</Text>
            {ref.clinical_notes ? (
              <>
                <Text style={[styles.cardLabel, { marginTop: 12 }]}>CLINICAL NOTES</Text>
                <Text style={styles.bodyText}>{ref.clinical_notes}</Text>
              </>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={() => download(ref)}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Download referral letter</Text>
              </>
            )}
          </TouchableOpacity>

          {isDoctor && ref.status === 'pending' ? (
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.outlineBtn, { flex: 1 }]}
                onPress={() => updateStatus(ref, 'accepted')}
                disabled={busy}
              >
                <Text style={styles.outlineBtnText}>Mark accepted</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.outlineBtn, { flex: 1, borderColor: '#C62828' }]}
                onPress={() => updateStatus(ref, 'cancelled')}
                disabled={busy}
              >
                <Text style={[styles.outlineBtnText, { color: '#C62828' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── List ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6B7C5C']} />
        }
      >
        <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#2D3A2B" />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Referrals</Text>
            <Text style={styles.sub}>
              {patientId ? 'Specialist referrals for this patient' : 'Your specialist referrals'}
            </Text>
          </View>
          {canRefer && patientId ? (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {items.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="document-text-outline" size={48} color="#CCC" />
            <Text style={styles.muted}>No referrals yet</Text>
            {canRefer && patientId ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowCreate(true)}>
                <Text style={styles.primaryBtnText}>Create referral</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          items.map((ref) => {
            const chip = STATUS_CHIP[ref.status] || STATUS_CHIP.pending;
            return (
              <TouchableOpacity
                key={ref.id}
                style={styles.listCard}
                onPress={() => setSelected(ref)}
                activeOpacity={0.7}
              >
                <View style={styles.listHead}>
                  <Text style={styles.listTitle}>{ref.specialist_type}</Text>
                  <View style={[styles.miniBadge, { backgroundColor: chip.bg }]}>
                    <Text style={[styles.miniBadgeText, { color: chip.fg }]}>{chip.label}</Text>
                  </View>
                </View>
                <Text style={styles.muted}>
                  {fmtDate(ref.referred_at || ref.created_at)} ·{' '}
                  <Text style={{ color: URGENCY_COLOR[ref.urgency], fontWeight: '600' }}>
                    {ref.urgency}
                  </Text>
                </Text>
                <Text style={styles.listReason} numberOfLines={2}>
                  {ref.reason}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoKey}>{label}</Text>
      <Text style={[styles.infoVal, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F6' },
  container: { padding: 16, paddingBottom: 40 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backLabel: { fontSize: 15, color: '#2D3A2B', fontWeight: '600' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  sub: { fontSize: 13, color: '#777', marginTop: 2 },
  muted: { fontSize: 13, color: '#888' },
  error: { color: '#C62828', marginBottom: 12 },
  addBtn: {
    backgroundColor: '#6B7C5C',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  listReason: { fontSize: 13, color: '#555', marginTop: 6 },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  miniBadgeText: { fontSize: 11, fontWeight: '700' },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 14,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7C5C',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  big: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  bodyText: { fontSize: 14, color: '#333', lineHeight: 20 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  infoKey: { fontSize: 13, color: '#777' },
  infoVal: { fontSize: 13, fontWeight: '600', color: '#222', maxWidth: '60%', textAlign: 'right' },
  primaryBtn: {
    backgroundColor: '#6B7C5C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: '#6B7C5C',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    marginHorizontal: 4,
  },
  outlineBtnText: { color: '#6B7C5C', fontWeight: '700', fontSize: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222',
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EEE',
    marginRight: 6,
    marginBottom: 6,
  },
  chipOn: { backgroundColor: '#6B7C5C' },
  chipText: { fontSize: 13, color: '#444', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
});