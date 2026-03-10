import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Controller } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import { Card, SectionHeader } from '@/components/ui';
import { colors, spacing } from '@/styles/tokens';
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
          <Pressable onPress={() => setEditMode(true)} style={styles.editBtn}>
            <Ionicons name="pencil" size={20} color={colors.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        ) : null}
      />
      <Card style={styles.card}>
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
            <Pressable onPress={cancelEdit} style={[styles.btn, styles.btnSecondary]} disabled={saving}>
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSubmit(saveProfile)} style={[styles.btn, styles.btnPrimary]} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Save Changes</Text>}
            </Pressable>
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: spacing.md },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: spacing.md, elevation: 1 },
  fieldGroup: { marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 16, color: colors.text },
  inputDisabled: { color: colors.muted },
  error: { marginTop: 4, fontSize: 12, color: colors.danger },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnSecondary: { backgroundColor: colors.border },
  btnSecondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
