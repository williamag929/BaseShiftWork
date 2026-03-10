import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { colors, spacing } from '@/styles/tokens';
import { useLogin } from '@/hooks/useLogin';

export default function LoginScreen() {
  const router = useRouter();
  const { form, loading, showBiometric, biometricType, handleLogin, handleBiometricLogin } = useLogin();
  const { control, handleSubmit, formState: { errors } } = form;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
      </View>
      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange } }) => (
              <TextInput style={styles.input} placeholder="Enter your email" placeholderTextColor={colors.muted} value={value} onChangeText={onChange} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            )}
          />
          {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange } }) => (
              <TextInput style={styles.input} placeholder="Enter your password" placeholderTextColor={colors.muted} value={value} onChangeText={onChange} secureTextEntry autoComplete="password" />
            )}
          />
          {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}
        </View>
        <Button label={loading ? 'Signing in...' : 'Sign In'} onPress={handleSubmit(handleLogin)} loading={loading} />
        {showBiometric && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
            <Pressable style={styles.biometricBtn} onPress={handleBiometricLogin}>
              <Ionicons name="finger-print" size={24} color={colors.primary} />
              <Text style={styles.biometricBtnText}>Sign in with {biometricType}</Text>
            </Pressable>
          </>
        )}
        <Pressable style={styles.linkBtn} onPress={() => router.push('/(auth)/register' as any)}>
          <Text style={styles.linkText}>Don't have an account? Register</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  header: { paddingTop: 80, paddingHorizontal: 32, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#fff', opacity: 0.9 },
  form: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 32, paddingTop: 40 },
  inputContainer: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: { backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text },
  error: { marginTop: 4, fontSize: 12, color: colors.danger },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: 16, color: colors.muted, fontSize: 14, fontWeight: '500' },
  biometricBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, paddingVertical: 16, borderRadius: 12, borderWidth: 2, borderColor: colors.primary, gap: 8 },
  biometricBtnText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  linkBtn: { marginTop: 16, alignItems: 'center' },
  linkText: { color: colors.primary, fontSize: 14, fontWeight: '500' },
});
