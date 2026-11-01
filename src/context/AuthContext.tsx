// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../services/supabase/client';
import { PatientProfile } from '../services/api/profile';
import { Session, User } from '@supabase/supabase-js';
import { Staff, StaffRole } from '../types';

// Registration details are kept here between "sign up" and "email verified".
// The patients row can only be written once the user has a session, which they
// only get after entering the emailed code.
const PENDING_REG_KEY = 'clinicconnect_pending_registration';

// The role of whoever is currently logged in. 'patient' comes from a row in
// `patients`; the StaffRole values come from `staff.role` for anyone else.
export type AppRole = 'patient' | StaffRole | null;

interface PendingRegistration {
  email: string;
  patientData: any;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: PatientProfile | null;
  staffProfile: Staff | null;
  role: AppRole;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Step 1: create the auth account. needsVerification=true means a code was emailed. */
  register: (
    email: string,
    password: string,
    patientData: any
  ) => Promise<{ needsVerification: boolean }>;
  /** Step 2: confirm the emailed code, create the patient profile and sign in. */
  verifyRegistration: (email: string, code: string) => Promise<PatientProfile>;
  resendVerificationCode: (email: string) => Promise<void>;
  cancelRegistration: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: any) => Promise<PatientProfile>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---- pending registration storage (SecureStore can throw on web) ----------
async function savePending(p: PendingRegistration) {
  try {
    await SecureStore.setItemAsync(PENDING_REG_KEY, JSON.stringify(p));
  } catch (e) {
    console.warn('Could not store pending registration:', e);
  }
}

async function readPending(): Promise<PendingRegistration | null> {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_REG_KEY);
    return raw ? (JSON.parse(raw) as PendingRegistration) : null;
  } catch {
    return null;
  }
}

async function clearPending() {
  try {
    await SecureStore.deleteItemAsync(PENDING_REG_KEY);
  } catch {
    /* ignore */
  }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Inserts the row in `patients` for a freshly verified auth user. */
async function createPatientProfile(
  userId: string,
  email: string,
  patientData: any
): Promise<PatientProfile> {
  const profileData = {
    user_id: userId,
    first_name: patientData.firstName || '',
    last_name: patientData.lastName || '',
    email,
    contact_number: patientData.contactNumber || '',
    id_number: patientData.idNumber || '',
    gender: patientData.gender || null,
    ethnicity: patientData.ethnicity || null,
    date_of_birth: patientData.dateOfBirth || null,
    address: {
      streetNumber: patientData.streetNumber || '',
      streetName: patientData.streetName || '',
      city: patientData.city || '',
      postalCode: patientData.postalCode || '',
      province: patientData.province || '',
    },
    next_of_kin_name: patientData.nextOfKinName || null,
    next_of_kin_relation: patientData.nextOfKinRelation || null,
    next_of_kin_contact: patientData.nextOfKinContact || null,
    notification_preference: {
      sms: !!patientData.smsNotifications,
      email: !!patientData.emailNotifications,
      inApp: !!patientData.inAppNotifications,
    },
    medical_aid_number: patientData.medicalAidNumber || null,
    medical_aid_plan: patientData.medicalAidPlan || null,
  };

  const { data, error } = await supabase.from('patients').insert(profileData).select().single();

  if (error) throw error;
  return data as PatientProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [staffProfile, setStaffProfile] = useState<Staff | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const fetchProfile = async (userId: string, email?: string | null): Promise<PatientProfile | null> => {
    if (!userId) return null;
    setIsFetching(true);

    try {
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (patientError) {
        console.error('❌ Error fetching patient profile:', patientError);
        setProfile(null);
        setStaffProfile(null);
        setRole(null);
        return null;
      }

      if (patientData) {
        setProfile(patientData as PatientProfile);
        setRole('patient');
        setStaffProfile(null);
        return patientData as PatientProfile;
      }

      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (staffError) {
        console.error('❌ Error fetching staff profile:', staffError);
      }

      if (staffData) {
        setStaffProfile(staffData as Staff);
        setProfile(null);
        setRole(staffData.role as StaffRole);
        return null;
      }

      setProfile(null);
      setStaffProfile(null);
      setRole(null);
      return null;
    } catch (error) {
      console.error('❌ Error in fetchProfile:', error);
      setProfile(null);
      setStaffProfile(null);
      setRole(null);
      return null;
    } finally {
      setIsFetching(false);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id, user.email);
    }
  };

  const updateProfile = async (data: any) => {
    if (!user?.id) throw new Error('No user authenticated');

    const { data: updated, error } = await supabase
      .from('patients')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating profile:', error);
      throw error;
    }

    setProfile(updated as PatientProfile);
    return updated as PatientProfile;
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id, currentSession.user.email);
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: Session | null) => {
      console.log('🔄 Auth state changed:', event);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        await fetchProfile(session.user.id, session.user.email);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setStaffProfile(null);
        setRole(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      if (error.message?.toLowerCase().includes('not confirmed')) {
        throw new Error(
          "Your email hasn't been verified yet. Register again with the same email to get a new code."
        );
      }
      throw error;
    }

    if (data.user) {
      setSession(data.session);
      setUser(data.user);
      await fetchProfile(data.user.id, data.user.email);
    }
  };

  const register = async (email: string, password: string, patientData: any) => {
    const cleanEmail = normalizeEmail(email);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    if (authData.session) {
      const profile = await createPatientProfile(authData.user.id, cleanEmail, patientData);
      setProfile(profile);
      setRole('patient');
    }

    return {
      needsVerification: false,
    };
  };

  const verifyRegistration = async (email: string, code: string): Promise<PatientProfile> => {
    const cleanEmail = normalizeEmail(email);
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: code,
      type: 'signup',
    });

    if (verifyError) throw verifyError;
    if (!verifyData.user) throw new Error('Verification failed');

    const profile = await createPatientProfile(verifyData.user.id, cleanEmail, {});
    setProfile(profile);
    setRole('patient');
    return profile;
  };

  const resendVerificationCode = async (email: string) => {
    const cleanEmail = normalizeEmail(email);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
    });
    if (error) throw error;
  };

  const cancelRegistration = async () => {
    await clearPending();
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    staffProfile,
    role,
    isLoading,
    login,
    register,
    verifyRegistration,
    resendVerificationCode,
    cancelRegistration,
    logout,
    refreshProfile,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}