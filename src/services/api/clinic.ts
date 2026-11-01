import { supabase } from '../supabase/client';
import { Clinic } from '../../types';

export type { Clinic };

export const clinicApi = {
  async getAll(): Promise<Clinic[]> {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('status', 'active')
      .order('clinic_name');
    if (error) throw error;
    return (data || []) as Clinic[];
  },

  async getAllForAdmin(): Promise<Clinic[]> {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .order('clinic_name');
    if (error) throw error;
    return (data || []) as Clinic[];
  },

  async getById(id: string): Promise<Clinic | null> {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as Clinic | null;
  },

  async getDetails(clinicId: string) {
    const { data: clinic, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', clinicId)
      .single();
    if (error) throw error;

    const [{ data: services }, { data: staff }, { data: timeSlots }] =
      await Promise.all([
        supabase
          .from('services')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('status', 'active'),
        supabase
          .from('staff')
          .select('id, first_name, last_name, role')
          .eq('clinic_id', clinicId)
          .eq('status', 'active'),
        supabase
          .from('time_slots')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('is_available', true)
          .order('date')
          .limit(20),
      ]);

    return {
      ...clinic,
      services: services || [],
      staff: staff || [],
      time_slots: timeSlots || [],
    };
  },

  async create(payload: Partial<Clinic>): Promise<Clinic> {
    const { data, error } = await supabase
      .from('clinics')
      .insert({
        clinic_name: payload.clinic_name,
        location: payload.location,
        address: payload.address || payload.location,
        contact_details: payload.contact_details,
        operating_hours: payload.operating_hours,
        status: payload.status || 'active',
      })
      .select()
      .single();
    if (error) throw error;
    return data as Clinic;
  },

  async update(id: string, payload: Partial<Clinic>): Promise<Clinic> {
    const { data, error } = await supabase
      .from('clinics')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Clinic;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('clinics')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
