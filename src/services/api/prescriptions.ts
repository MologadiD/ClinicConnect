import { supabase } from '../supabase/client';
import { toDateString } from '../slots';
import { notifyPatient } from '../notifications/pushNotifications';

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
  /**
   * Prescriber details copied onto the prescription when it was issued, so a
   * patient's copy can show who issued it. Needs the columns doctor_name,
   * doctor_specialization and doctor_license_number on public.prescriptions.
   */
  doctor_name?: string | null;
  doctor_specialization?: string | null;
  doctor_license_number?: string | null;
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
  doctor_id: string;
  appointment_id: string;
  medical_record_id?: string;
  medications: MedicationItem[];
  diagnosis?: string;
  notes?: string;
  valid_until?: string; // YYYY-MM-DD
}

export class PrescriptionRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrescriptionRuleError';
  }
}

/**
 * Status as the patient should see it. A prescription stays `active` in the
 * database until a doctor cancels it, but once its valid_until date has passed
 * it is treated as expired everywhere (checked on read, no scheduled job).
 */
export function effectiveStatus(
  rx: Pick<Prescription, 'status' | 'valid_until'>,
  today: string = toDateString(new Date())
): Prescription['status'] {
  if (rx.status === 'active' && rx.valid_until && rx.valid_until < today) return 'expired';
  return rx.status;
}

/** True only while the prescription may still be used. */
export function isUsable(rx: Pick<Prescription, 'status' | 'valid_until'>): boolean {
  return effectiveStatus(rx) === 'active';
}

/**
 * Who issued a prescription. Prefers the details stored on the prescription
 * when it was issued. Falls back to the staff record joined on read (staff can
 * read it, patients cannot), then to a generic label.
 */
export function prescriberOf(
  rx: Pick<
    Prescription,
    'doctor' | 'doctor_name' | 'doctor_specialization' | 'doctor_license_number'
  >
): { name: string; specialization: string | null; licenseNumber: string | null; known: boolean } {
  const joined = rx.doctor
    ? `${rx.doctor.first_name || ''} ${rx.doctor.last_name || ''}`.trim()
    : '';
  const full = (rx.doctor_name || joined || '').trim().replace(/^dr\.?\s+/i, '');
  return {
    name: full ? `Dr ${full}` : 'Doctor',
    specialization: rx.doctor_specialization || rx.doctor?.specialization || null,
    licenseNumber: rx.doctor_license_number || null,
    known: !!full,
  };
}

/** True when the database rejected an insert because a column does not exist yet. */
function isMissingColumnError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    /column .* does not exist|could not find the .* column/i.test(error.message || '')
  );
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** The only legal move for a prescription is out of `active`, and only once. */
async function moveFromActive(id: string, to: 'cancelled' | 'expired'): Promise<void> {
  const { data, error } = await supabase
    .from('prescriptions')
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'active')
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new PrescriptionRuleError('This prescription is no longer active, so it cannot be changed.');
  }
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

  /** Prescriptions issued for one appointment (newest first). */
  getByAppointment: async (appointmentId: string): Promise<Prescription[]> => {
    const { data, error } = await supabase
      .from('prescriptions')
      .select(
        `
        *,
        doctor:doctor_id ( first_name, last_name, specialization )
      `
      )
      .eq('appointment_id', appointmentId)
      .order('issued_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Prescription[];
  },

  /**
   * Issue a prescription. Rules (enforced here because the database does not):
   *  - only a Doctor may issue one
   *  - it belongs to exactly one appointment, which must be `confirmed`
   *    (visit in progress) and belong to the same patient
   *  - at least one complete medication line
   *  - a valid-until date that is a real date, today or later
   * An issued prescription is never edited. To change it, cancel it and
   * issue a new one, so there is always a clean history.
   */
  create: async (
    input: CreatePrescriptionInput,
    actorRole: string | null
  ): Promise<Prescription> => {
    if (actorRole !== 'Doctor') {
      throw new PrescriptionRuleError('Only doctors can issue prescriptions.');
    }
    if (!input.patient_id || !input.doctor_id || !input.appointment_id) {
      throw new PrescriptionRuleError(
        'A prescription must be linked to a patient, a doctor and an appointment.'
      );
    }

    const medications = (input.medications || []).map((m) => ({
      name: (m.name || '').trim(),
      dosage: (m.dosage || '').trim(),
      frequency: (m.frequency || '').trim(),
      duration: (m.duration || '').trim(),
      ...(m.instructions?.trim() ? { instructions: m.instructions.trim() } : {}),
    }));
    if (medications.length === 0) {
      throw new PrescriptionRuleError('Add at least one medication.');
    }
    if (medications.some((m) => !m.name || !m.dosage || !m.frequency || !m.duration)) {
      throw new PrescriptionRuleError(
        'Every medication needs a name, dosage, frequency and duration.'
      );
    }

    const validUntil = (input.valid_until || '').trim();
    if (!isRealDate(validUntil)) {
      throw new PrescriptionRuleError('Enter the valid-until date as YYYY-MM-DD.');
    }
    if (validUntil < toDateString(new Date())) {
      throw new PrescriptionRuleError('The valid-until date cannot be in the past.');
    }

    const { data: appt, error: apptErr } = await supabase
      .from('appointments')
      .select('id, patient_id, status')
      .eq('id', input.appointment_id)
      .maybeSingle();
    if (apptErr) throw apptErr;
    if (!appt) throw new PrescriptionRuleError('Appointment not found.');
    if (appt.patient_id !== input.patient_id) {
      throw new PrescriptionRuleError('This appointment belongs to a different patient.');
    }
    if (appt.status !== 'confirmed') {
      throw new PrescriptionRuleError(
        'A prescription can only be issued while the appointment is confirmed, before the visit is completed.'
      );
    }

    // Copy the prescriber's details onto the prescription. Patients cannot read the
    // staff table, so without this their copy could not say who issued it.
    const { data: doc } = await supabase
      .from('staff')
      .select('first_name, last_name, specialization, license_number')
      .eq('id', input.doctor_id)
      .maybeSingle();
    const snapshot = doc
      ? {
          doctor_name: `${doc.first_name || ''} ${doc.last_name || ''}`.trim() || null,
          doctor_specialization: doc.specialization || null,
          doctor_license_number: doc.license_number || null,
        }
      : {};

    const row = {
      patient_id: input.patient_id,
      doctor_id: input.doctor_id,
      appointment_id: input.appointment_id,
      medical_record_id: input.medical_record_id ?? null,
      medications,
      diagnosis: input.diagnosis?.trim() || null,
      notes: input.notes?.trim() || null,
      valid_until: validUntil,
      status: 'active',
    };

    let result = await supabase
      .from('prescriptions')
      .insert({ ...row, ...snapshot })
      .select()
      .single();

    if (error) throw error;
    const created = data as Prescription;

    // Tell the patient (push + in-app). Never blocks or fails the create.
    notifyPatient(created.patient_id, {
      title: 'New prescription',
      body: `Your doctor issued a prescription (${medications.length} medication${
        medications.length > 1 ? 's' : ''
      }), valid until ${validUntil}. Tap to view and download it.`,
      data: {
        type: 'prescription',
        screen: 'Prescription',
        prescriptionId: created.id,
        appointmentId: created.appointment_id ?? undefined,
      },
    }).catch(() => {});

    return created;
  },

  /** Doctor withdraws an active prescription (e.g. issued in error). */
  cancel: async (id: string, actorRole: string | null): Promise<void> => {
    if (actorRole !== 'Doctor') {
      throw new PrescriptionRuleError('Only doctors can cancel a prescription.');
    }
    await moveFromActive(id, 'cancelled');
  },

  /**
   * Kept for compatibility. A prescription can only leave `active`
   * (to cancelled / expired) and can never be re-activated or reused.
   */
  updateStatus: async (id: string, status: Prescription['status']): Promise<void> => {
    if (status !== 'cancelled' && status !== 'expired') {
      throw new PrescriptionRuleError('A prescription can only be cancelled or expired.');
    }
    await moveFromActive(id, status);
  },

  /**
   * Build a plain-text prescription suitable for sharing / "download".
   */
  formatAsText: (rx: Prescription, patientName?: string): string => {
    const prescriber = prescriberOf(rx);
    const doctorName = prescriber.name;
    const specialty = prescriber.specialization ? ` (${prescriber.specialization})` : '';
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
      prescriber.licenseNumber ? `Registration no.: ${prescriber.licenseNumber}` : '',
      `Date: ${issued}`,
      `Valid until: ${valid}`,
      `Status: ${effectiveStatus(rx)}`,
      isUsable(rx) ? '' : '*** THIS PRESCRIPTION IS NO LONGER VALID ***',
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

  /**
   * Build a clean, print-ready HTML document for PDF generation.
   */
  formatAsHtml: (rx: Prescription, patientName?: string): string => {
    const prescriber = prescriberOf(rx);
    const doctorName = prescriber.name;
    const specialty = prescriber.specialization ? ` · ${prescriber.specialization}` : '';
    const issued = rx.issued_at
      ? new Date(rx.issued_at).toLocaleDateString('en-ZA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '—';
    const valid = rx.valid_until
      ? new Date(rx.valid_until).toLocaleDateString('en-ZA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'N/A';
    const status = effectiveStatus(rx);
    const usable = isUsable(rx);

    const medRows = (rx.medications || [])
      .map(
        (m, i) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e8e8e8;vertical-align:top;width:28px;color:#888;">${i + 1}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e8e8e8;">
            <div style="font-weight:700;font-size:14px;color:#1a1a1a;">${escapeHtml(m.name)}</div>
            <div style="font-size:12px;color:#555;margin-top:3px;">
              ${escapeHtml(m.dosage)} &nbsp;·&nbsp; ${escapeHtml(m.frequency)} &nbsp;·&nbsp; ${escapeHtml(m.duration)}
            </div>
            ${m.instructions ? `<div style="font-size:12px;color:#666;margin-top:4px;font-style:italic;">${escapeHtml(m.instructions)}</div>` : ''}
          </td>
        </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Prescription</title>
  <style>
    @page { margin: 36px; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #222;
      font-size: 13px;
      line-height: 1.45;
      margin: 0;
      padding: 0;
    }
    .header {
      background: #6B7C5C;
      color: #fff;
      padding: 18px 22px;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .header p {
      margin: 4px 0 0;
      font-size: 12px;
      opacity: 0.9;
    }
    .card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .body { padding: 20px 22px; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 24px;
      margin-bottom: 18px;
    }
    .meta-item label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #888;
      margin-bottom: 2px;
    }
    .meta-item span {
      font-size: 13px;
      font-weight: 600;
      color: #222;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6B7C5C;
      margin: 18px 0 8px;
      padding-bottom: 4px;
      border-bottom: 2px solid #6B7C5C;
    }
    table { width: 100%; border-collapse: collapse; }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
    }
    .badge-active { background: #E8F5E9; color: #2E7D32; }
    .badge-expired { background: #FFF3E0; color: #E65100; }
    .badge-cancelled { background: #FFEBEE; color: #C62828; }
    .badge-completed { background: #F3E5F5; color: #7B1FA2; }
    .warning {
      background: #FFEBEE;
      color: #C62828;
      padding: 10px 14px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 16px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e8e8e8;
      font-size: 11px;
      color: #888;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Clinic-Connect Prescription</h1>
      <p>Electronic prescription · Present at a registered pharmacy</p>
    </div>
    <div class="body">
      ${!usable ? `<div class="warning">⚠ This prescription is no longer valid (${status})</div>` : ''}

      <div class="meta-grid">
        <div class="meta-item">
          <label>Patient</label>
          <span>${escapeHtml(patientName || '—')}</span>
        </div>
        <div class="meta-item">
          <label>Issued by</label>
          <span>${escapeHtml(doctorName)}${escapeHtml(specialty)}</span>
          ${prescriber.licenseNumber ? `<br><span style="font-size:11px;font-weight:400;color:#666;">Reg. no. ${escapeHtml(prescriber.licenseNumber)}</span>` : ''}
        </div>
        <div class="meta-item">
          <label>Date issued</label>
          <span>${escapeHtml(issued)}</span>
        </div>
        <div class="meta-item">
          <label>Valid until</label>
          <span>${escapeHtml(valid)}</span>
        </div>
        <div class="meta-item">
          <label>Status</label>
          <span class="badge badge-${status}">${status.toUpperCase()}</span>
        </div>
        <div class="meta-item">
          <label>Prescription ID</label>
          <span style="font-family:monospace;font-size:12px;">${rx.id.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>

      ${rx.diagnosis ? `
        <div class="section-title">Diagnosis</div>
        <p style="margin:0 0 8px;font-size:14px;">${escapeHtml(rx.diagnosis)}</p>
      ` : ''}

      <div class="section-title">Medications</div>
      <table>
        <tbody>
          ${medRows || '<tr><td style="padding:12px 0;color:#888;">No medications listed</td></tr>'}
        </tbody>
      </table>

      ${rx.notes ? `
        <div class="section-title">Notes</div>
        <p style="margin:0;font-size:13px;color:#444;">${escapeHtml(rx.notes)}</p>
      ` : ''}

      <div class="footer">
        Generated by Clinic-Connect · This is an official electronic prescription.<br/>
        Please verify patient identity before dispensing.
      </div>
    </div>
  </div>
</body>
</html>`;
  },
};

/** Minimal HTML escaping for the PDF template. */
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}