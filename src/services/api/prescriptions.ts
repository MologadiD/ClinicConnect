import { supabase } from '../supabase/client';

export interface MedicationItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface Prescription {
  id: string;
  patient_id: string;
  doctor_id?: string | null;
  appointment_id?: string | null;
  medical_record_id?: string | null;
  medications: MedicationItem[];
  diagnosis?: string | null;
  notes?: string | null;
  status: 'active' | 'completed' | 'cancelled' | 'expired';
  issued_at?: string;
  valid_until?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Joins */
  doctor?: {
    first_name?: string;
    last_name?: string;
    specialization?: string | null;
  } | null;
  patients?: {
    first_name?: string;
    last_name?: string;
  } | null;
}

export interface CreatePrescriptionInput {
  patient_id: string;
  doctor_id?: string;
  appointment_id?: string;
  medical_record_id?: string;
  medications: MedicationItem[];
  diagnosis?: string;
  notes?: string;
  valid_until?: string; // YYYY-MM-DD
}

export const prescriptionsApi = {
  /** List prescriptions for a patient (newest first) */
  getByPatient: async (patientId: string): Promise<Prescription[]> => {
    const { data, error } = await supabase
      .from('prescriptions')
      .select(
        `
        *,
        doctor:doctor_id ( first_name, last_name, specialization )
      `
      )
      .eq('patient_id', patientId)
      .order('issued_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Prescription[];
  },

  getById: async (id: string): Promise<Prescription | null> => {
    const { data, error } = await supabase
      .from('prescriptions')
      .select(
        `
        *,
        doctor:doctor_id ( first_name, last_name, specialization ),
        patients:patient_id ( first_name, last_name )
      `
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as Prescription | null;
  },

  create: async (input: CreatePrescriptionInput): Promise<Prescription> => {
    const { data, error } = await supabase
      .from('prescriptions')
      .insert({
        patient_id: input.patient_id,
        doctor_id: input.doctor_id ?? null,
        appointment_id: input.appointment_id ?? null,
        medical_record_id: input.medical_record_id ?? null,
        medications: input.medications,
        diagnosis: input.diagnosis ?? null,
        notes: input.notes ?? null,
        valid_until: input.valid_until ?? null,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return data as Prescription;
  },

  updateStatus: async (
    id: string,
    status: Prescription['status']
  ): Promise<void> => {
    const { error } = await supabase
      .from('prescriptions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Build a plain-text prescription suitable for sharing / "download".
   */
  formatAsText: (rx: Prescription, patientName?: string): string => {
    const doctorName = rx.doctor
      ? `Dr ${rx.doctor.first_name || ''} ${rx.doctor.last_name || ''}`.trim()
      : 'Doctor';
    const specialty = rx.doctor?.specialization
      ? ` (${rx.doctor.specialization})`
      : '';
    const issued = rx.issued_at
      ? new Date(rx.issued_at).toLocaleDateString('en-ZA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';
    const valid = rx.valid_until
      ? new Date(rx.valid_until).toLocaleDateString('en-ZA')
      : 'N/A';

    const meds = (rx.medications || [])
      .map(
        (m, i) =>
          `${i + 1}. ${m.name}\n` +
          `   Dosage: ${m.dosage}\n` +
          `   Frequency: ${m.frequency}\n` +
          `   Duration: ${m.duration}` +
          (m.instructions ? `\n   Instructions: ${m.instructions}` : '')
      )
      .join('\n\n');

    return [
      '═══════════════════════════════════════',
      '         CLINIC-CONNECT PRESCRIPTION',
      '═══════════════════════════════════════',
      '',
      `Patient: ${patientName || '—'}`,
      `Issued by: ${doctorName}${specialty}`,
      `Date: ${issued}`,
      `Valid until: ${valid}`,
      `Status: ${rx.status}`,
      '',
      rx.diagnosis ? `Diagnosis: ${rx.diagnosis}\n` : '',
      '── Medications ────────────────────────',
      meds || '(none listed)',
      '',
      rx.notes ? `Notes: ${rx.notes}\n` : '',
      '───────────────────────────────────────',
      'This is an electronic prescription issued via Clinic-Connect.',
      'Please present this at a registered pharmacy.',
      '═══════════════════════════════════════',
    ]
      .filter(Boolean)
      .join('\n');
  },
};

export default prescriptionsApi;
