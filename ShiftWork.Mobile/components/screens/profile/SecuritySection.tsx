import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable, Switch } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Card, SectionHeader } from '@/components/ui';
import { colors, spacing } from '@/styles/tokens';
import { pinChangeSchema, PinChangeFormData } from '@/utils/schemas/profile';
import type { UseProfileReturn } from '@/hooks/useProfile';

interface Props {
  profile: Pick<UseProfileReturn, 'saving' | 'changingPin' | 'setChangingPin' | 'biometricAvailable' | 'biometricEnabled' | 'biometricType' | 'handleToggleBiometric' | 'handleChangePin'>;
}

export function SecuritySection({ profile }: Props) {
  const { saving, changingPin, setChangingPin, biometricAvailable, biometricEnabled, biometricType, handleToggleBiometric, handleChangePin } = profile;
  const { control, handleSubmit, reset, formState: { errors } } = useForm<PinChangeFormData>({ resolver: zodResolver(pinChangeSchema) });

  const onSubmit = async (data: PinChangeFormData) => {
    await handleChangePin(data.currentPin, data.newPin);
    reset();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const cancelPin = () => { setChangingPin(false); reset(); };

  return (
    <View style={styles.section}>
      <SectionHeader title="Security" />
      <Card style={styles.card}>
        {biometricAvailable && (
          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Ionicons name="finger-print" size={24} color={colors.primary} />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{biometricType} Login</Text>
                <Text style={styles.optionSubtitle}>Use {biometricType.toLowerCase()} to sign in quickly</Text>
              </View>
            </View>
            <Switch value={biometricEnabled} onValueChange={handleToggleBiometric} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
          </View>
        )}

        {!changingPin ? (
          <Pressable onPress={() => setChangingPin(true)} style={[styles.optionRow, biometricAvailable && styles.optionBordered]}>
            <Ionicons name="lock-closed" size={24} color={colors.primary} />
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Change PIN</Text>
              <Text style={styles.optionSubtitle}>Update your 4-digit PIN for kiosk access</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ) : (
          <View style={[biometricAvailable && styles.optionBordered]}>
            {(['currentPin', 'newPin', 'confirmPin'] as const).map((field, i) => (
              <View key={field} style={styles.fieldGroup}>
                <Text style={styles.label}>{['Current PIN', 'New PIN', 'Confirm New PIN'][i]}</Text>
                <Controller
                  control={control}
                  name={field}
                  render={({ field: { value, onChange } }) => (
                    <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={['Enter current PIN', 'Enter new 4-digit PIN', 'Re-enter new PIN'][i]} keyboardType="numeric" maxLength={4} secureTextEntry />
                  )}
                />
                {errors[field] && <Text style={styles.error}>{errors[field]?.message}</Text>}
              </View>
            ))}
            <View style={styles.btnRow}>
              <Pressable onPress={cancelPin} style={[styles.btn, styles.btnSecondary]} disabled={saving}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSubmit(onSubmit)} style={[styles.btn, styles.btnPrimary]} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Update PIN</Text>}
              </Pressable>
            </View>
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: spacing.md },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: spacing.md, elevation: 1 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 4 },
  optionBordered: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, marginTop: 12 },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
  optionSubtitle: { fontSize: 14, color: colors.muted },
  fieldGroup: { marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 16, color: colors.text },
  error: { marginTop: 4, fontSize: 12, color: colors.danger },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnSecondary: { backgroundColor: colors.border },
  btnSecondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
