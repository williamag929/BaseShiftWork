import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { registrationService, CompanyRegistrationRequest } from '@/services/registration.service';
import { colors } from '@/styles/theme';

// NOTE: Firebase Auth is currently mocked in config/firebase.ts
// When real Firebase Auth is enabled, import { auth } from '@/config/firebase'
// and use auth.createUserWithEmailAndPassword(email, password)
// Until then, we collect the user's info and register via a stub UID.

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  // Step 1 fields
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2 fields
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [timeZone, setTimeZone] = useState('UTC');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // TODO: When Firebase Auth mock is replaced, call:
      //   const credential = await auth.createUserWithEmailAndPassword(email, password);
      //   const uid = credential.user.uid;
      // For now, use a stub UID based on email hash
      const stubUid = `stub_${email.replace(/[^a-z0-9]/gi, '_')}`;

      const request: CompanyRegistrationRequest = {
        firebaseUid: stubUid,
        userEmail: email,
        userDisplayName: displayName,
        companyName,
        companyEmail,
        companyPhone: companyPhone || undefined,
        timeZone,
      };

      const response = await registrationService.register(request);
      // Store companyId for onboarding screen
      // TODO: use AsyncStorage for persistence
      (global as any)._onboardingCompanyId = response.companyId;

      router.replace('/(auth)/onboarding');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Create your ShiftWork account</Text>
      <Text style={styles.stepIndicator}>Step {step} of {totalSteps}</Text>

      {!!errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      {step === 1 && (
        <View>
          <Text style={styles.sectionTitle}>Your Account</Text>
          <TextInput style={styles.input} placeholder="Full Name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
          <TextInput style={styles.input} placeholder="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Password (min 8 chars)" value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setStep(2)} disabled={!displayName || !email || password.length < 8}>
            <Text style={styles.btnPrimaryText}>Next: Company Info →</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.sectionTitle}>Your Company</Text>
          <TextInput style={styles.input} placeholder="Company Name" value={companyName} onChangeText={setCompanyName} />
          <TextInput style={styles.input} placeholder="Company Email" value={companyEmail} onChangeText={setCompanyEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Phone (optional)" value={companyPhone} onChangeText={setCompanyPhone} keyboardType="phone-pad" />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(1)}>
              <Text style={styles.btnSecondaryText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => setStep(3)} disabled={!companyName || !companyEmail}>
              <Text style={styles.btnPrimaryText}>Next: Confirm →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={styles.sectionTitle}>Confirm & Create Account</Text>
          <Text style={styles.summaryLine}><Text style={styles.summaryLabel}>Name: </Text>{displayName}</Text>
          <Text style={styles.summaryLine}><Text style={styles.summaryLabel}>Email: </Text>{email}</Text>
          <Text style={styles.summaryLine}><Text style={styles.summaryLabel}>Company: </Text>{companyName}</Text>
          <Text style={styles.summaryLine}><Text style={styles.summaryLabel}>Company Email: </Text>{companyEmail}</Text>
          <Text style={styles.notice}>
            Your account starts on the Free plan with demo sandbox data so you can explore immediately.
          </Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(2)}>
              <Text style={styles.btnSecondaryText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnPrimary, styles.btnSuccess]} onPress={handleRegister} disabled={loading}>
              <Text style={styles.btnPrimaryText}>{loading ? 'Creating…' : 'Create Account'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.signInLink}>
        <Text style={styles.signInLinkText}>Already have an account? Sign in</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: 4 },
  stepIndicator: { color: colors.muted, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: '#fff', fontSize: 16 },
  btnPrimary: { backgroundColor: colors.primary, padding: 14, borderRadius: 8, alignItems: 'center', flex: 1, marginLeft: 4 },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnSuccess: { backgroundColor: '#28a745' },
  btnSecondary: { backgroundColor: '#6c757d', padding: 14, borderRadius: 8, alignItems: 'center', flex: 1, marginRight: 4 },
  btnSecondaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  row: { flexDirection: 'row', marginTop: 8 },
  error: { backgroundColor: '#f8d7da', color: '#721c24', padding: 12, borderRadius: 8, marginBottom: 16 },
  summaryLine: { fontSize: 15, marginBottom: 8 },
  summaryLabel: { fontWeight: '600' },
  notice: { color: colors.muted, marginVertical: 16, lineHeight: 20 },
  signInLink: { marginTop: 24, alignItems: 'center' },
  signInLinkText: { color: colors.primary },
});
