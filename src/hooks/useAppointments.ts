import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase/client';
import { useAuth } from '../context/AuthContext';

export function useAppointments() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAppointments = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clinics(*), services(*)')
        .eq('patient_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAppointments(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  return { appointments, loading, fetchAppointments };
}

export default useAppointments;
