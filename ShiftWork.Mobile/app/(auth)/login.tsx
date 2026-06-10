import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Button } from '@/components/ui';
import { colors, spacing, radius } from '@/styles/tokens';
import { useLogin } from '@/hooks/useLogin';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { form, loading, showBiometric, biometricType, handleLogin, handleBiometricLogin } = useLogin();
  const { control, handleSubmit, formState: { errors } } = form;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />

      {/* Hero banner */}
      <Animated.View entering={FadeInDown.duration(500)} style={[styles.hero, { paddingTop: insets.top + 32 }]}>
        <View style={styles.logoMark}>
          <Ionicons name="time" size={36} color="#fff" />
        </View>
        <Text style={styles.heroTitle}>ShiftWork</Text>
        <Text style={styles.heroSub}>Sign in to your account</Text>
      </Animated.View>

      {/* Form sheet */}
      <Animated.View entering={FadeInUp.delay(120).duration(500)} style={styles.sheet}>
        <ScrollView
          contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { value, onChange } }) => (
                <View style={[styles.inputWrap, !!errors.email && styles.inputError]}>
                  <Ionicons name="mail-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="you@email.com"
                    placeholderTextColor={colors.muted}
                    value={value}
                    onChangeText={onChange}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    returnKeyType="next"
                  />
                </View>
              )}
            />
            {errors.email && (
              <Text style={styles.errorMsg}>{errors.email.message}</Text>
            )}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { value, onChange } }) => (
                <View style={[styles.inputWrap, !!errors.password && styles.inputError]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.muted}
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry
                    autoComplete="password"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit(handleLogin)}
                  />
                </View>
              )}
            />
            {errors.password && (
              <Text style={styles.errorMsg}>{errors.password.message}</Text>
            )}
          </View>

          <View style={styles.ctaBlock}>
            <Button
              label={loading ? 'Signing in…' : 'Sign In'}
              onPress={handleSubmit(handleLogin)}
              loading={loading}
            />
          </View>

          {showBiometric && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>
              <Pressable
                style={({ pressed }) => [styles.biometricBtn, pressed && { opacity: 0.75 }]}
                onPress={handleBiometricLogin}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Sign in with ${biometricType}`}
              >
                <Ionicons name="finger-print" size={22} color={colors.primary} />
                <Text style={styles.biometricLabel}>Sign in with {biometricType}</Text>
              </Pressable>
            </>
          )}

          <Pressable
            style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.65 }]}
            onPress={() => router.push('/(auth)/register' as any)}
          >
            <Text style={styles.linkText}>
              Don't have an account?{' '}
              <Text style={styles.linkAccent}>Create one</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },

  // Hero
  hero: {
    alignItems: 'center',
    paddingBottom: 36,
    paddingHorizontal: spacing.xxxl,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSub: { fontSize: 16, color: 'rgba(255,255,255,0.82)', letterSpacing: -0.2 },

  // Form sheet (floats on top of hero)
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  formScroll: { paddingHorizontal: 28, paddingTop: 32 },

  // Field
  fieldGroup: { marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputError: { borderColor: colors.danger },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    height: '100%',
  },
  errorMsg: { marginTop: 6, fontSize: 12, color: colors.danger, letterSpacing: 0.1 },

  ctaBlock: { marginTop: 8, marginBottom: 16 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: colors.borderOpaque },
  dividerLabel: {
    marginHorizontal: 14,
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
  },

  // Biometric
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  biometricLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: -0.3,
  },

  // Footer link
  linkRow: { alignItems: 'center', paddingVertical: 12 },
  linkText: { fontSize: 15, color: colors.muted },
  linkAccent: { color: colors.primary, fontWeight: '600' },
});
