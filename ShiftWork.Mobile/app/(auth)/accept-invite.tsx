import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { colors, spacing } from '@/styles/tokens';
import { authService } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { saveToken, saveUserData, saveCompanyId } from '@/utils/storage.utils';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/utils/logger';
import { acceptInviteSchema, AcceptInviteFormData } from '@/utils/schemas/auth';

export default function AcceptInviteScreen() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Params arrive from the invite deep-link:
  // joblogsmart://accept-invite?token=...&companyId=...&personId=...&email=...&name=...
  const { token, companyId, personId, email, name } = useLocalSearchParams<{
    token: string;
    companyId: string;
    personId: string;
    email: string;
    name?: string;
  }>();

  const setCompanyId = useAuthStore((s) => s.setCompanyId);
  const setPersonId = useAuthStore((s) => s.setPersonId);
  const setPersonProfile = useAuthStore((s) => s.setPersonProfile);

  const { control, handleSubmit, formState: { errors } } = useForm<AcceptInviteFormData>({
    resolver: zodResolver(acceptInviteSchema),
  });

  if (!token || !companyId || !personId || !email) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorMsg}>
          Invalid invite link. Please use the link from your invitation email.
        </Text>
      </View>
    );
  }

  const handleAccept = async (data: AcceptInviteFormData) => {
    setLoading(true);
    try {
      const result = await authService.acceptInvite({
        token,
        companyId,
        personId: Number(personId),
        email,
        password: data.password,
      });

      await saveToken(result.token);
      setPersonId(Number(result.personId));
      setCompanyId(result.companyId);
      setPersonProfile({ email: result.email, name: result.name, photoUrl: result.photoUrl });
      await saveUserData({ personId: result.personId, email: result.email, name: result.name });
      await saveCompanyId(result.companyId);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate to company-select — it auto-skips if the user has only one company.
      router.replace('/(auth)/company-select' as any);
    } catch (error: any) {
      logger.error('[AcceptInvite] error:', error);
      toast.error(error?.message || 'Failed to activate invite. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Welcome{name ? `, ${name}` : ''}!</Text>
        <Text style={styles.subtitle}>Set a password to activate your account</Text>
        <Text style={styles.emailLabel}>{email}</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange } }) => (
              <TextInput
                style={styles.input}
                placeholder="Choose a password (min. 6 characters)"
                placeholderTextColor={colors.muted}
                value={value}
                onChangeText={onChange}
                secureTextEntry
                autoComplete="new-password"
              />
            )}
          />
          {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { value, onChange } }) => (
              <TextInput
                style={styles.input}
                placeholder="Re-enter your password"
                placeholderTextColor={colors.muted}
                value={value}
                onChangeText={onChange}
                secureTextEntry
                autoComplete="new-password"
              />
            )}
          />
          {errors.confirmPassword && <Text style={styles.error}>{errors.confirmPassword.message}</Text>}
        </View>

        <Button
          label={loading ? 'Activating...' : 'Activate Account'}
          onPress={handleSubmit(handleAccept)}
          loading={loading}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, backgroundColor: colors.primary },
  container: { flex: 1, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  errorMsg: { color: '#fff', fontSize: 16, textAlign: 'center' },
  header: { paddingTop: 80, paddingHorizontal: 32, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#fff', opacity: 0.9, marginBottom: 4 },
  emailLabel: { fontSize: 14, color: '#fff', opacity: 0.75 },
  form: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 32, paddingTop: 40, paddingBottom: 40 },
  inputContainer: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: { backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text },
  error: { marginTop: 4, fontSize: 12, color: colors.danger },
});
