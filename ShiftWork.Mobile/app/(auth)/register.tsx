import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, spacing, radius } from '@/styles/tokens';
import { useRegister } from '@/hooks/useRegister';

// Step indicator dots
function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={dot.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            dot.dot,
            i + 1 === current ? dot.active : i + 1 < current ? dot.done : dot.idle,
          ]}
        />
      ))}
    </View>
  );
}

const dot = StyleSheet.create({
  row: { flexDirection: 'row', gap: 7, marginBottom: 28 },
  dot:   { width: 8, height: 8, borderRadius: 4 },
  active: { width: 22, backgroundColor: colors.primary },
  done:   { backgroundColor: colors.success },
  idle:   { backgroundColor: colors.borderOpaque },
});

// Reusable labelled text input
function Field({
  label, placeholder, value, onChange, error,
  secureTextEntry, keyboardType, autoCapitalize,
  icon, returnKeyType, onSubmitEditing,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  icon?: keyof typeof Ionicons.glyphMap;
  returnKeyType?: any;
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={field.group}>
      <Text style={field.label}>{label}</Text>
      <View style={[field.wrap, !!error && field.errBorder]}>
        {icon && <Ionicons name={icon} size={17} color={colors.muted} style={field.icon} />}
        <TextInput
          style={field.input}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={onChange}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
      </View>
      {error && <Text style={field.errMsg}>{error}</Text>}
    </View>
  );
}

const field = StyleSheet.create({
  group: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 7, letterSpacing: 0.1 },
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, height: 52, paddingHorizontal: 14,
  },
  errBorder: { borderColor: colors.danger },
  icon: { marginRight: 9 },
  input: { flex: 1, fontSize: 16, color: colors.text },
  errMsg: { marginTop: 5, fontSize: 12, color: colors.danger },
});

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { step, setStep, loading, step1Form, step2Form, handleRegister } = useRegister();
  const totalSteps = 3;
  const s1 = step1Form;
  const s2 = step2Form;
  const s1v = s1.watch();
  const s2v = s2.watch();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StatusBar style="dark" />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join ShiftWork in 3 easy steps</Text>
          <StepDots total={totalSteps} current={step} />
        </View>

        {/* Step 1 — Account */}
        {step === 1 && (
          <Animated.View entering={FadeIn.duration(280)}>
            <Text style={styles.stepTitle}>Your Account</Text>
            <Controller control={s1.control} name="displayName" render={({ field: { value, onChange } }) => (
              <Field label="Full Name" placeholder="Jane Doe" value={value} onChange={onChange}
                error={s1.formState.errors.displayName?.message} icon="person-outline"
                autoCapitalize="words" returnKeyType="next" />
            )} />
            <Controller control={s1.control} name="email" render={({ field: { value, onChange } }) => (
              <Field label="Email" placeholder="jane@company.com" value={value} onChange={onChange}
                error={s1.formState.errors.email?.message} icon="mail-outline"
                keyboardType="email-address" autoCapitalize="none" returnKeyType="next" />
            )} />
            <Controller control={s1.control} name="password" render={({ field: { value, onChange } }) => (
              <Field label="Password" placeholder="Min 8 characters" value={value} onChange={onChange}
                error={s1.formState.errors.password?.message} icon="lock-closed-outline"
                secureTextEntry returnKeyType="done" />
            )} />
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.82 }]}
              onPress={s1.handleSubmit(() => setStep(2))}
            >
              <Text style={styles.btnPrimaryText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </Animated.View>
        )}

        {/* Step 2 — Company */}
        {step === 2 && (
          <Animated.View entering={FadeIn.duration(280)}>
            <Text style={styles.stepTitle}>Your Company</Text>
            <Controller control={s2.control} name="companyName" render={({ field: { value, onChange } }) => (
              <Field label="Company Name" placeholder="Acme Corp" value={value} onChange={onChange}
                error={s2.formState.errors.companyName?.message} icon="business-outline"
                returnKeyType="next" />
            )} />
            <Controller control={s2.control} name="companyEmail" render={({ field: { value, onChange } }) => (
              <Field label="Company Email" placeholder="hello@acme.com" value={value} onChange={onChange}
                error={s2.formState.errors.companyEmail?.message} icon="mail-outline"
                keyboardType="email-address" autoCapitalize="none" returnKeyType="next" />
            )} />
            <Controller control={s2.control} name="companyPhone" render={({ field: { value, onChange } }) => (
              <Field label="Company Phone (optional)" placeholder="+1 555 000 0000" value={value ?? ''} onChange={onChange}
                icon="call-outline" keyboardType="phone-pad" returnKeyType="done" />
            )} />
            <View style={styles.btnRow}>
              <Pressable
                style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.75 }]}
                onPress={() => setStep(1)}
              >
                <Ionicons name="arrow-back" size={18} color={colors.primary} />
                <Text style={styles.btnSecondaryText}>Back</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.btnPrimary, styles.btnFlex, pressed && { opacity: 0.82 }]}
                onPress={s2.handleSubmit(() => setStep(3))}
              >
                <Text style={styles.btnPrimaryText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Step 3 — Confirm */}
        {step === 3 && (
          <Animated.View entering={FadeIn.duration(280)}>
            <Text style={styles.stepTitle}>Review & Create</Text>
            <View style={styles.summaryCard}>
              {[
                { icon: 'person-outline', label: 'Name', val: s1v.displayName },
                { icon: 'mail-outline',   label: 'Email', val: s1v.email },
                { icon: 'business-outline', label: 'Company', val: s2v.companyName },
                { icon: 'mail-outline',   label: 'Company Email', val: s2v.companyEmail },
              ].map(({ icon, label, val }) => (
                <View key={label} style={styles.summaryRow}>
                  <Ionicons name={icon as any} size={16} color={colors.muted} style={{ width: 22 }} />
                  <Text style={styles.summaryLabel}>{label}</Text>
                  <Text style={styles.summaryVal} numberOfLines={1}>{val}</Text>
                </View>
              ))}
            </View>
            <View style={styles.noticeRow}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.noticeText}>
                You'll start on the Free plan with sample data to explore.
              </Text>
            </View>
            <View style={styles.btnRow}>
              <Pressable
                style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.75 }]}
                onPress={() => setStep(2)}
              >
                <Ionicons name="arrow-back" size={18} color={colors.primary} />
                <Text style={styles.btnSecondaryText}>Back</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.btnPrimary, styles.btnSuccess, styles.btnFlex, pressed && { opacity: 0.82 }]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <Text style={styles.btnPrimaryText}>Creating…</Text>
                ) : (
                  <>
                    <Text style={styles.btnPrimaryText}>Create Account</Text>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </>
                )}
              </Pressable>
            </View>
          </Animated.View>
        )}

        <Pressable
          onPress={() => router.replace('/(auth)/login')}
          style={({ pressed }) => [styles.signInLink, pressed && { opacity: 0.65 }]}
        >
          <Text style={styles.signInText}>
            Already have an account? <Text style={styles.signInAccent}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24 },

  header: { marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: colors.primary, letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 20 },
  stepTitle: { fontSize: 20, fontWeight: '600', color: colors.text, letterSpacing: -0.4, marginBottom: 20 },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, paddingVertical: 15, paddingHorizontal: 24,
    borderRadius: radius.lg, marginTop: 8, minHeight: 52,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 16, letterSpacing: -0.3 },
  btnSuccess: { backgroundColor: colors.success },
  btnFlex: { flex: 1 },
  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 15, paddingHorizontal: 18,
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.primary,
    backgroundColor: colors.surface, marginTop: 8, minHeight: 52,
  },
  btnSecondaryText: { color: colors.primary, fontWeight: '600', fontSize: 16 },

  summaryCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingVertical: 8, paddingHorizontal: 16, marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  summaryLabel: { fontSize: 14, color: colors.muted, width: 110 },
  summaryVal: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text },
  noticeRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  noticeText: { flex: 1, fontSize: 13, color: colors.muted, lineHeight: 19 },

  signInLink: { alignItems: 'center', paddingVertical: 16, marginTop: 12 },
  signInText: { fontSize: 15, color: colors.muted },
  signInAccent: { color: colors.primary, fontWeight: '600' },
});
