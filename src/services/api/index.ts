import { supabase } from '../supabase/client';
import { clinicApi } from './clinic';
import { profileApi } from './profile';

export const authApi = {
  async forgotPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },
  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
};

export const medicalApi = {
  async getPatientRecords(userId: string) {
    // Resolve patient id from user_id
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!patient) return [];

    const { data, error } = await supabase
      .from('medical_records')
      .select('*')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createRecord(payload: Record<string, any>) {
    const { data, error } = await supabase
      .from('medical_records')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

export const appointmentApi = {
  async getForPatient(patientId: string) {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, clinics(*), services(*)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, clinics(*), services(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async cancel(id: string) {
    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

const api = {
  auth: authApi,
  clinic: clinicApi,
  profile: profileApi,
  medical: medicalApi,
  appointment: appointmentApi,
};

export default api;
export { clinicApi, profileApi };
