import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Controller } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SectionHeader } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, spacing, radius } from '@/styles/tokens';
import type { UseProfileReturn } from '@/hooks/useProfile';

interface Props {
  profile: Pick<UseProfileReturn, 'editMode' | 'setEditMode' | 'saving' | 'form' | 'saveProfile' | 'cancelEdit'>;
}

export function ProfileInfoSection({ profile }: Props) {
  const { editMode, setEditMode, saving, form, saveProfile, cancelEdit } = profile;
  const { control, handleSubmit, formState: { errors } } = form;

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Personal Information"
        rightSlot={!editMode ? (
          <PressableScale
            onPress={() => { setEditMode(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={styles.editBtn}
          >
            <Ionicons name="pencil-outline" size={16} color={colors.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </PressableScale>
        ) : null}
      />
      <View style={styles.card}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Name</Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange } }) => (
              <TextInput style={[styles.input, !editMode && styles.inputDisabled]} value={value} onChangeText={onChange} placeholder="Full Name" editable={editMode} />
            )}
          />
          {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange } }) => (
              <TextInput style={[styles.input, !editMode && styles.inputDisabled]} value={value} onChangeText={onChange} placeholder="Email" keyboardType="email-address" autoCapitalize="none" editable={editMode} />
            )}
          />
          {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <Controller
            control={control}
            name="phoneNumber"
            render={({ field: { value, onChange } }) => (
              <TextInput style={[styles.input, !editMode && styles.inputDisabled]} value={value} onChangeText={onChange} placeholder="Phone Number" keyboardType="phone-pad" editable={editMode} />
            )}
          />
        </View>

        {editMode && (
          <View style={styles.btnRow}>
            <PressableScale onPress={cancelEdit} style={[styles.btn, styles.btnSecondary]} disabled={saving}>
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </PressableScale>
            <PressableScale
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleSubmit(saveProfile)(); }}
              style={[styles.btn, styles.btnPrimary]}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Save Changes</Text>}
            </PressableScale>
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
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: colors.text,
  },
  inputDisabled: { color: colors.muted, backgroundColor: colors.background },
  error: { marginTop: 4, fontSize: 12, color: colors.danger },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: radius.lg, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnSecondary: { backgroundColor: colors.borderOpaque + '40', borderWidth: 1, borderColor: colors.border },
  btnSecondaryText: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
