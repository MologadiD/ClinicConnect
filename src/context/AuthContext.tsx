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
    next_of_kin_name: patientData.nextOfKinName || '',
    next_of_kin_relation: patientData.nextOfKinRelationship || '',
    next_of_kin_contact: patientData.nextOfKinContactNumber || '',
    notification_preference: {
      sms: patientData.sms || false,
      email: patientData.notifyEmail || false,
      inApp: patientData.inApp || false,
    },
    medical_aid_number: patientData.medicalAidNumber || null,
    medical_aid_plan: patientData.medicalAidPlan || null,
    status: 'active',
  };

  const { data, error } = await supabase.from('patients').insert(profileData).select().single();
  if (error) throw new Error('Failed to create patient profile: ' + error.message);
  return data as PatientProfile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [staffProfile, setStaffProfile] = useState<Staff | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // While true, the auth listener must NOT try to resolve the account: the
  // user has just verified their email but their patients row doesn't exist yet.
  const registeringRef = useRef(false);

  // Resolve who this user is: check `patients` first, then `staff`.
  // A user only ever has a row in one of the two tables.
  const fetchProfile = async (userId: string, email?: string | null) => {
    if (registeringRef.current) return profile;
    if (isFetching) {
      console.log('⏳ Already fetching profile, skipping...');
      return profile;
    }

    try {
      setIsFetching(true);
      console.log('🔍 Resolving account for user:', userId);

      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (patientError) {
        console.error('❌ Error fetching patient profile:', patientError);
      }

      if (patientData) {
        setProfile(patientData as PatientProfile);
        setStaffProfile(null);
        setRole('patient');
        return patientData as PatientProfile;
      }

      // Not a patient — check whether this is a staff account instead.
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (staffError) {
        console.error('❌ Error fetching staff profile:', staffError);
      }

      if (staffData) {
        setProfile(null);
        setStaffProfile(staffData as Staff);
        setRole(staffData.role as StaffRole);
        return null;
      }

      // Self-heal: the email was verified but saving the profile failed (or the
      // app was closed first). Finish the registration from the saved details.
      if (email) {
        const pending = await readPending();
        if (pending && pending.email === normalizeEmail(email)) {
          try {
            const created = await createPatientProfile(userId, pending.email, pending.patientData);
            await clearPending();
            setProfile(created);
            setStaffProfile(null);
            setRole('patient');
            return created;
          } catch (healError) {
            console.error('❌ Could not finish pending registration:', healError);
          }
        }
      }

      console.log('⚠️ No patient or staff record found for user:', userId);
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

  // Refresh profile for current user
  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id, user.email);
    }
  };

  // Update profile
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

  // Check session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id, session.user.email);
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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

  // ---------------------------------------------------------------------
  // Registration with email verification
  // ---------------------------------------------------------------------
  const register = async (email: string, password: string, patientData: any) => {
    const cleanEmail = normalizeEmail(email);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    // Supabase doesn't error for an already-registered email (so it can't be used
    // to find out who has an account). It returns a user with no identities instead.
    if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    // "Confirm email" is switched OFF in Supabase: we already have a session,
    // so finish straight away (the app still works while testing).
    if (authData.session) {
      registeringRef.current = true;
      try {
        const created = await createPatientProfile(authData.user.id, cleanEmail, patientData);
        setSession(authData.session);
        setUser(authData.user);
        setProfile(created);
        setStaffProfile(null);
        setRole('patient');
      } finally {
        registeringRef.current = false;
      }
      return { needsVerification: false };
    }

    // "Confirm email" is ON: a code has been emailed. Keep the details until it is entered.
    await savePending({ email: cleanEmail, patientData });
    return { needsVerification: true };
  };

  const verifyRegistration = async (email: string, code: string) => {
    const cleanEmail = normalizeEmail(email);
    registeringRef.current = true;

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: code.trim(),
        type: 'signup',
      });
      if (error) throw error;
      if (!data.user || !data.session) {
        throw new Error('Verification failed. Please try again.');
      }

      const pending = await readPending();
      if (!pending || pending.email !== cleanEmail) {
        await supabase.auth.signOut();
        throw new Error(
          'Your email is verified, but the details you entered were lost. Please contact support.'
        );
      }

      // One retry in case of a network blip
      let created: PatientProfile | null = null;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 2 && !created; attempt++) {
        try {
          created = await createPatientProfile(data.user.id, cleanEmail, pending.patientData);
        } catch (e) {
          lastError = e;
        }
      }

      if (!created) {
        // Details stay saved; signing in later will finish the setup automatically.
        console.error('❌ Profile creation failed after verification:', lastError);
        await supabase.auth.signOut();
        throw new Error(
          "Your email is verified, but we couldn't save your profile. Please sign in to finish setting up your account."
        );
      }

      await clearPending();
      setSession(data.session);
      setUser(data.user);
      setProfile(created);
      setStaffProfile(null);
      setRole('patient');
      return created;
    } finally {
      registeringRef.current = false;
    }
  };

  const resendVerificationCode = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizeEmail(email),
    });
    if (error) throw error;
  };

  const cancelRegistration = async () => {
    await clearPending();
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setStaffProfile(null);
    setRole(null);
    setUser(null);
    setSession(null);
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
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}