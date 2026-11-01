// src/screens/auth/VerifyEmailScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/Button';

// Supabase sends a 6-digit code by default. If you change "Email OTP Length" in
// the Supabase dashboard (Authentication → Providers → Email), change this too.
const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(name.length - 2, 2))}@${domain}`;
}

export default function VerifyEmailScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { verifyRegistration, resendVerificationCode, cancelRegistration } = useAuth();
  const email: string = route.params?.email || '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);

  // Resend countdown
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const handleChange = (value: string) => {
    setError('');
    setCode(value.replace(/\D/g, '').slice(0, CODE_LENGTH));
  };

  const handleVerify = async () => {
    if (code.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code from your email`);
      return;
    }
    setVerifying(true);
    setError('');
    try {
      await verifyRegistration(email, code);
      // Success: AuthContext now has a session + profile, so AppNavigator
      // switches to the patient home screen on its own.
    } catch (err: any) {
      const message: string = err?.message || 'Verification failed. Please try again.';
      const friendly = /expired|invalid/i.test(message)
        ? 'That code is wrong or has expired. Check it, or request a new one.'
        : message;
      setError(friendly);
      // This screen can already be unmounted if the failure happened after the
      // code was accepted, so use an Alert as well.
      Alert.alert('Verification', friendly);
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      await resendVerificationCode(email);
      setSecondsLeft(RESEND_SECONDS);
      Alert.alert('Code sent', `A new code was sent to ${maskEmail(email)}.`);
    } catch (err: any) {
      setError(err?.message || 'Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleBack = async () => {
    await cancelRegistration();
    navigation.goBack();
  };

  const digits = code.padEnd(CODE_LENGTH, ' ').split('');

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backIcon} onPress={handleBack}>
          <Text style={[styles.backIconText, { color: theme.colors.primary }]}>Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: theme.colors.text }]}>Verify your email</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          We sent a {CODE_LENGTH}-digit code to{'\n'}
          <Text style={{ fontWeight: '600', color: theme.colors.text }}>{maskEmail(email)}</Text>
        </Text>

        {/* Boxes are display only; the real (invisible) input sits on top */}
        <Pressable style={styles.codeRow} onPress={() => inputRef.current?.focus()}>
          {digits.map((d, i) => {
            const active = i === Math.min(code.length, CODE_LENGTH - 1);
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  {
                    borderColor: error
                      ? theme.colors.error
                      : active
                      ? theme.colors.primary
                      : theme.colors.border,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              >
                <Text style={[styles.boxText, { color: theme.colors.text }]}>{d.trim()}</Text>
              </View>
            );
          })}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
            caretHidden
            style={styles.hiddenInput}
            onSubmitEditing={handleVerify}
          />
        </Pressable>

        {error ? (
          <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
        ) : null}

        <Button
          title="Verify"
          onPress={handleVerify}
          loading={verifying}
          disabled={code.length !== CODE_LENGTH}
          style={styles.verifyButton}
        />

        <View style={styles.resendRow}>
          <Text style={{ color: theme.colors.textSecondary }}>Didn't get it? </Text>
          <TouchableOpacity onPress={handleResend} disabled={secondsLeft > 0 || resending}>
            <Text
              style={{
                color: secondsLeft > 0 ? theme.colors.textSecondary : theme.colors.primary,
                fontWeight: '600',
              }}
            >
              {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : resending ? 'Sending…' : 'Resend code'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
          Check your spam folder if you can't find the email.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  backIcon: { marginBottom: 16, alignSelf: 'flex-start' },
  backIconText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 32 },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  box: {
    width: 46,
    height: 56,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: { fontSize: 24, fontWeight: '700' },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  error: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  verifyButton: { marginTop: 24 },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  hint: { fontSize: 13, textAlign: 'center', marginTop: 12 },
});