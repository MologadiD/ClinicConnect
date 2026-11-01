// src/screens/auth/StaffLoginScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { supabase } from "../../services/supabase/client";

type StaffLoginNavigationProp = NativeStackNavigationProp<RootStackParamList, 'StaffLogin'>;

const StaffLoginScreen: React.FC = () => {
  const navigation = useNavigation<StaffLoginNavigationProp>();
  const [staffId, setStaffId] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleStaffLogin = async () => {
    if (!staffId.trim() || !password.trim()) {
      setError("Please enter both Staff ID and Password");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const regNumber = staffId.trim();
      console.log(`🔍 Looking for staff with ID: ${regNumber}`);

      // Step 1: resolve Staff ID -> email via a SECURITY DEFINER RPC.
      // A direct select on `staff` is blocked by RLS before login (anon role).
      const { data: staffEmail, error: lookupError } = await supabase.rpc(
        'get_staff_login_email',
        { p_reg: regNumber }
      );

      if (lookupError) {
        console.error('❌ Staff lookup error:', lookupError);
        setError("Database error. Please try again.");
        setIsLoading(false);
        return;
      }

      if (!staffEmail) {
        console.log('❌ No staff found with ID:', regNumber);
        setError("Invalid Staff ID. Please check and try again.");
        setIsLoading(false);
        return;
      }

      console.log(`🔑 Attempting login with email: ${staffEmail}`);

      // Step 2: sign in with the resolved email
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: staffEmail as string,
        password: password,
      });

      if (loginError) {
        console.error('❌ Login error:', loginError);
        setError("Invalid password. Please try again.");
        setIsLoading(false);
        return;
      }

      if (!loginData.user) {
        console.error('❌ No user returned from login');
        setError("Login failed. Please try again.");
        setIsLoading(false);
        return;
      }

      console.log('✅ Login successful:', loginData.user.email);

      // Step 3: now authenticated, so RLS allows reading own staff row
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('first_name, last_name, role')
        .eq('user_id', loginData.user.id)
        .maybeSingle();

      if (staffError) {
        console.warn('⚠️ Could not load staff profile:', staffError.message);
      }

      setIsLoading(false);
      // Do not navigate to role home screens here — they only exist in the
      // authenticated stack. onAuthStateChange + AppNavigator will switch
      // automatically once the session is set.
      Alert.alert(
        "Success",
        staffData
          ? `Welcome ${staffData.first_name} ${staffData.last_name}!`
          : "Welcome!"
      );

    } catch (error: any) {
      console.error('❌ Unexpected error:', error);
      setError(error.message || "Login failed. Please try again.");
      setIsLoading(false);
    }
  };

  const handleBackToPatientLogin = () => {
    navigation.navigate("Login");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBackToPatientLogin} style={styles.backButton}>
                <Text style={styles.backArrow}>←</Text>
                <Text style={styles.backText}>Staff Login</Text>
              </TouchableOpacity>

              <View style={styles.iconWrapper}>
                <Text style={styles.staffIcon}>👨‍⚕️</Text>
              </View>
            </View>

            {/* Body */}
            <View style={styles.body}>
              <Text style={styles.heading}>Staff Sign In</Text>
              <Text style={styles.subtitle}>
                Enter your staff ID and password to access the staff portal
              </Text>

              {/* Staff ID Field */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>STAFF ID</Text>
                <TextInput
                  style={[styles.input, error && styles.inputError]}
                  value={staffId}
                  onChangeText={(text) => {
                    setStaffId(text);
                    setError("");
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!isLoading}
                  placeholder="Enter your Staff ID"
                  placeholderTextColor="#999"
                />
              </View>

              {/* Password Field */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>PASSWORD</Text>
                <TextInput
                  style={[styles.input, error && styles.inputError]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError("");
                  }}
                  secureTextEntry={true}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  placeholder="Enter your password"
                  placeholderTextColor="#999"
                />
              </View>

              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}

              {/* Sign In Button */}
              <TouchableOpacity 
                style={[styles.btnPrimary, isLoading && styles.btnDisabled]} 
                onPress={handleStaffLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Sign in</Text>
                )}
              </TouchableOpacity>

              {/* OR divider */}
              <Text style={styles.orDivider}>OR</Text>

              {/* Patient Login Link */}
              <TouchableOpacity 
                style={styles.btnSecondary} 
                onPress={handleBackToPatientLogin}
                disabled={isLoading}
              >
                <Text style={styles.btnSecondaryText}>Not Staff? Sign in here</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#e8d5b7",
  },
  flex: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  card: {
    width: 300,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  backArrow: {
    fontSize: 18,
    color: "#1e2a3a",
    marginRight: 6,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e2a3a",
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  staffIcon: {
    fontSize: 32,
  },
  body: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: "center",
  },
  heading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e2a3a",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: "#666666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  formGroup: {
    width: "100%",
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#444444",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1e2a3a",
    width: "100%",
  },
  inputError: {
    borderColor: "#E53935",
  },
  errorText: {
    fontSize: 12,
    color: "#E53935",
    marginBottom: 8,
    textAlign: "center",
  },
  btnPrimary: {
    width: "100%",
    backgroundColor: "#1e2a3a",
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPrimaryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  orDivider: {
    textAlign: "center",
    fontSize: 12,
    color: "#999999",
    marginVertical: 10,
  },
  btnSecondary: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#1e2a3a",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnSecondaryText: {
    color: "#1e2a3a",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default StaffLoginScreen;