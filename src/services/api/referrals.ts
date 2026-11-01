import { supabase } from '../supabase/client';

export type ReferralUrgency = 'routine' | 'urgent' | 'emergency';
export type ReferralStatus =
  | 'pending'
  | 'accepted'
  | 'scheduled'
  | 'completed'
  | 'cancelled';

export interface Referral {
  id: string;
  patient_id: string;
  referring_doctor_id?: string | null;
  specialist_type: string;
  specialist_name?: string | null;
  preferred_clinic_id?: string | null;
  reason: string;
  clinical_notes?: string | null;
  urgency: ReferralUrgency;
  status: ReferralStatus;
  referred_at?: string;
  appointment_id?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Joins */
  referring_doctor?: {
    first_name?: string;
    last_name?: string;
    specialization?: string | null;
  } | null;
  preferred_clinic?: {
    clinic_name?: string;
    location?: string;
  } | null;
  patients?: {
    first_name?: string;
    last_name?: string;
  } | null;
}

export interface CreateReferralInput {
  patient_id: string;
  referring_doctor_id?: string;
  specialist_type: string;
  specialist_name?: string;
  preferred_clinic_id?: string;
  reason: string;
  clinical_notes?: string;
  urgency?: ReferralUrgency;
}

export const SPECIALIST_TYPES = [
  'Cardiologist',
  'Dermatologist',
  'Endocrinologist',
  'ENT (Ear, Nose & Throat)',
  'Gastroenterologist',
  'Gynaecologist',
  'Neurologist',
  'Oncologist',
  'Ophthalmologist',
  'Orthopaedics',
  'Paediatrician',
  'Psychiatrist',
  'Pulmonologist',
  'Rheumatologist',
  'Urologist',
  'Other',
] as const;

export const referralsApi = {
  getByPatient: async (patientId: string): Promise<Referral[]> => {
    const { data, error } = await supabase
      .from('referrals')
      .select(
        `
        *,
        referring_doctor:referring_doctor_id ( first_name, last_name, specialization ),
        preferred_clinic:preferred_clinic_id ( clinic_name, location )
      `
      )
      .eq('patient_id', patientId)
      .order('referred_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Referral[];
  },

  getById: async (id: string): Promise<Referral | null> => {
    const { data, error } = await supabase
      .from('referrals')
      .select(
        `
        *,
        referring_doctor:referring_doctor_id ( first_name, last_name, specialization ),
        preferred_clinic:preferred_clinic_id ( clinic_name, location ),
        patients:patient_id ( first_name, last_name )
      `
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as Referral | null;
  },

  /** Referrals created by a specific doctor */
  getByDoctor: async (doctorId: string): Promise<Referral[]> => {
    const { data, error } = await supabase
      .from('referrals')
      .select(
        `
        *,
        patients:patient_id ( first_name, last_name ),
        preferred_clinic:preferred_clinic_id ( clinic_name, location )
      `
      )
      .eq('referring_doctor_id', doctorId)
      .order('referred_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Referral[];
  },

  create: async (input: CreateReferralInput): Promise<Referral> => {
    const { data, error } = await supabase
      .from('referrals')
      .insert({
        patient_id: input.patient_id,
        referring_doctor_id: input.referring_doctor_id ?? null,
        specialist_type: input.specialist_type,
        specialist_name: input.specialist_name ?? null,
        preferred_clinic_id: input.preferred_clinic_id ?? null,
        reason: input.reason,
        clinical_notes: input.clinical_notes ?? null,
        urgency: input.urgency ?? 'routine',
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data as Referral;
  },

  updateStatus: async (id: string, status: ReferralStatus): Promise<void> => {
    const { error } = await supabase
      .from('referrals')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  formatAsText: (ref: Referral, patientName?: string): string => {
    const doctorName = ref.referring_doctor
      ? `Dr ${ref.referring_doctor.first_name || ''} ${ref.referring_doctor.last_name || ''}`.trim()
      : 'Doctor';
    const date = ref.referred_at
      ? new Date(ref.referred_at).toLocaleDateString('en-ZA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';
    const clinic = ref.preferred_clinic?.clinic_name
      ? `${ref.preferred_clinic.clinic_name}${
          ref.preferred_clinic.location ? ` (${ref.preferred_clinic.location})` : ''
        }`
      : 'Any suitable facility';

    return [
      '═══════════════════════════════════════',
      '      CLINIC-CONNECT SPECIALIST REFERRAL',
      '═══════════════════════════════════════',
      '',
      `Patient: ${patientName || '—'}`,
      `Referring doctor: ${doctorName}`,
      `Date: ${date}`,
      `Urgency: ${ref.urgency.toUpperCase()}`,
      `Status: ${ref.status}`,
      '',
      `Specialist type: ${ref.specialist_type}`,
      ref.specialist_name ? `Preferred specialist: ${ref.specialist_name}` : '',
      `Preferred clinic / facility: ${clinic}`,
      '',
      '── Reason for referral ────────────────',
      ref.reason,
      '',
      ref.clinical_notes
        ? `Clinical notes:\n${ref.clinical_notes}\n`
        : '',
      '───────────────────────────────────────',
      'Please take this referral letter to the specialist or facility.',
      '═══════════════════════════════════════',
    ]
      .filter((l) => l !== '')
      .join('\n');
  },
};

export default referralsApi;
