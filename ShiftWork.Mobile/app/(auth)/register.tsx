import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/styles/tokens';
import { useRegister } from '@/hooks/useRegister';

export default function RegisterScreen() {
  const router = useRouter();
  const { step, setStep, loading, step1Form, step2Form, handleRegister } = useRegister();
  const totalSteps = 3;
  const s1 = step1Form;
  const s2 = step2Form;
  const s1v = s1.watch();
  const s2v = s2.watch();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Create your ShiftWork account</Text>
      <Text style={styles.stepIndicator}>Step {step} of {totalSteps}</Text>

      {step === 1 && (
        <View>
          <Text style={styles.sectionTitle}>Your Account</Text>
          <Controller control={s1.control} name="displayName" render={({ field: { value, onChange } }) => (
            <TextInput style={styles.input} placeholder="Full Name" value={value} onChangeText={onChange} autoCapitalize="words" />
          )} />
          {s1.formState.errors.displayName && <Text style={styles.error}>{s1.formState.errors.displayName.message}</Text>}
          <Controller control={s1.control} name="email" render={({ field: { value, onChange } }) => (
            <TextInput style={styles.input} placeholder="Email Address" value={value} onChangeText={onChange} keyboardType="email-address" autoCapitalize="none" />
          )} />
          {s1.formState.errors.email && <Text style={styles.error}>{s1.formState.errors.email.message}</Text>}
          <Controller control={s1.control} name="password" render={({ field: { value, onChange } }) => (
            <TextInput style={styles.input} placeholder="Password (min 8 chars)" value={value} onChangeText={onChange} secureTextEntry />
          )} />
          {s1.formState.errors.password && <Text style={styles.error}>{s1.formState.errors.password.message}</Text>}
          <Pressable style={styles.btnPrimary} onPress={s1.handleSubmit(() => setStep(2))}>
            <Text style={styles.btnPrimaryText}>Next: Company Info</Text>
          </Pressable>
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.sectionTitle}>Your Company</Text>
          <Controller control={s2.control} name="companyName" render={({ field: { value, onChange } }) => (
            <TextInput style={styles.input} placeholder="Company Name" value={value} onChangeText={onChange} />
          )} />
          {s2.formState.errors.companyName && <Text style={styles.error}>{s2.formState.errors.companyName.message}</Text>}
          <Controller control={s2.control} name="companyEmail" render={({ field: { value, onChange } }) => (
            <TextInput style={styles.input} placeholder="Company Email" value={value} onChangeText={onChange} keyboardType="email-address" autoCapitalize="none" />
          )} />
          {s2.formState.errors.companyEmail && <Text style={styles.error}>{s2.formState.errors.companyEmail.message}</Text>}
          <Controller control={s2.control} name="companyPhone" render={({ field: { value, onChange } }) => (
            <TextInput style={styles.input} placeholder="Phone (optional)" value={value} onChangeText={onChange} keyboardType="phone-pad" />
          )} />
          <View style={styles.row}>
            <Pressable style={styles.btnSecondary} onPress={() => setStep(1)}><Text style={styles.btnSecondaryText}>Back</Text></Pressable>
            <Pressable style={styles.btnPrimary} onPress={s2.handleSubmit(() => setStep(3))}><Text style={styles.btnPrimaryText}>Next: Confirm</Text></Pressable>
          </View>
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={styles.sectionTitle}>Confirm & Create Account</Text>
          <Text style={styles.summaryLine}><Text style={styles.summaryLabel}>Name: </Text>{s1v.displayName}</Text>
          <Text style={styles.summaryLine}><Text style={styles.summaryLabel}>Email: </Text>{s1v.email}</Text>
          <Text style={styles.summaryLine}><Text style={styles.summaryLabel}>Company: </Text>{s2v.companyName}</Text>
          <Text style={styles.summaryLine}><Text style={styles.summaryLabel}>Company Email: </Text>{s2v.companyEmail}</Text>
          <Text style={styles.notice}>Your account starts on the Free plan with demo sandbox data so you can explore immediately.</Text>
          <View style={styles.row}>
            <Pressable style={styles.btnSecondary} onPress={() => setStep(2)}><Text style={styles.btnSecondaryText}>Back</Text></Pressable>
            <Pressable style={[styles.btnPrimary, styles.btnSuccess]} onPress={handleRegister} disabled={loading}>
              <Text style={styles.btnPrimaryText}>{loading ? 'Creating...' : 'Create Account'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.signInLink}>
        <Text style={styles.signInLinkText}>Already have an account? Sign in</Text>
      </Pressable>
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
  error: { color: colors.danger, fontSize: 12, marginTop: -8, marginBottom: 8 },
  btnPrimary: { backgroundColor: colors.primary, padding: 14, borderRadius: 8, alignItems: 'center', flex: 1, marginLeft: 4 },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnSuccess: { backgroundColor: '#28a745' },
  btnSecondary: { backgroundColor: '#6c757d', padding: 14, borderRadius: 8, alignItems: 'center', flex: 1, marginRight: 4 },
  btnSecondaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  row: { flexDirection: 'row', marginTop: 8 },
  summaryLine: { fontSize: 15, marginBottom: 8 },
  summaryLabel: { fontWeight: '600' },
  notice: { color: colors.muted, marginVertical: 16, lineHeight: 20 },
  signInLink: { marginTop: 24, alignItems: 'center' },
  signInLinkText: { color: colors.primary },
});
