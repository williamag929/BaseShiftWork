import { View, Text, TextInput, StyleSheet, ActivityIndicator, Switch } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SectionHeader } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, spacing, radius } from '@/styles/tokens';
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
      <View style={styles.card}>
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
          <PressableScale
            onPress={() => { setChangingPin(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={[styles.optionRow, biometricAvailable && styles.optionBordered]}
          >
            <Ionicons name="lock-closed" size={24} color={colors.primary} />
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Change PIN</Text>
              <Text style={styles.optionSubtitle}>Update your 4-digit PIN for kiosk access</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </PressableScale>
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
              <PressableScale onPress={cancelPin} style={[styles.btn, styles.btnSecondary]} disabled={saving}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </PressableScale>
              <PressableScale
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleSubmit(onSubmit)(); }}
                style={[styles.btn, styles.btnPrimary]}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Update PIN</Text>}
              </PressableScale>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 4 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  optionBordered: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 14, marginTop: 12 },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 3 },
  optionSubtitle: { fontSize: 13, color: colors.muted },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: colors.text,
  },
  error: { marginTop: 4, fontSize: 12, color: colors.danger },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: radius.lg, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnSecondary: { borderWidth: 1, borderColor: colors.border },
  btnSecondaryText: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
