import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { Controller } from 'react-hook-form';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card, Button } from '@/components/ui';
import { colors, spacing } from '@/styles/tokens';
import { useTimeOffForm } from '@/hooks/useTimeOffForm';
import { timeOffTypes } from '@/utils/schemas/timeoff';

export default function TimeOffRequestScreen() {
  const router = useRouter();
  const { form, ptoBalance, estimatedHours, businessDays, showStartPicker, setShowStartPicker, showEndPicker, setShowEndPicker, submitting, onSubmit, onStartDateChange, onEndDateChange, formatDate } = useTimeOffForm();
  const { control, handleSubmit, watch, formState: { errors } } = form;
  const startDate = watch('startDate');
  const endDate = watch('endDate');

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>← Back</Text></Pressable>
        <Text style={styles.title}>Request Time Off</Text>
      </View>

      {ptoBalance !== null && (
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available PTO Balance</Text>
          <Text style={styles.balanceValue}>{ptoBalance.toFixed(2)} hours</Text>
        </Card>
      )}

      <View style={styles.form}>
        <View style={styles.group}>
          <Text style={styles.label}>Type</Text>
          <Controller
            control={control}
            name="type"
            render={({ field: { value, onChange } }) => (
              <View style={styles.typeRow}>
                {timeOffTypes.map((t) => (
                  <Pressable key={t} style={[styles.typeBtn, value === t && styles.typeBtnActive]} onPress={() => onChange(t)}>
                    <Text style={[styles.typeBtnText, value === t && styles.typeBtnTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Start Date</Text>
          <Controller
            control={control}
            name="startDate"
            render={() => (
              <Pressable style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.dateBtnText}>{formatDate(startDate)}</Text>
              </Pressable>
            )}
          />
          {showStartPicker && <DateTimePicker value={startDate} mode="date" display="default" onChange={onStartDateChange} minimumDate={new Date()} />}
          {errors.startDate && <Text style={styles.error}>{errors.startDate.message}</Text>}
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>End Date</Text>
          <Controller
            control={control}
            name="endDate"
            render={() => (
              <Pressable style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.dateBtnText}>{formatDate(endDate)}</Text>
              </Pressable>
            )}
          />
          {showEndPicker && <DateTimePicker value={endDate} mode="date" display="default" onChange={onEndDateChange} minimumDate={startDate} />}
          {errors.endDate && <Text style={styles.error}>{errors.endDate.message}</Text>}
        </View>

        <Card style={styles.estimateCard}>
          <Text style={styles.estimateLabel}>Estimated Hours</Text>
          <Text style={styles.estimateValue}>{estimatedHours} hours</Text>
          <Text style={styles.estimateNote}>Based on {businessDays} business days</Text>
        </Card>

        <View style={styles.group}>
          <Text style={styles.label}>Reason (Optional)</Text>
          <Controller
            control={control}
            name="reason"
            render={({ field: { value, onChange } }) => (
              <TextInput style={styles.textArea} value={value} onChangeText={onChange} placeholder="Why are you requesting time off?" placeholderTextColor={colors.muted} multiline numberOfLines={4} textAlignVertical="top" />
            )}
          />
        </View>

        <Button label={submitting ? 'Submitting...' : 'Submit Request'} onPress={handleSubmit(onSubmit)} loading={submitting} variant="primary" style={styles.submitBtn} />
        <Button label="Cancel" onPress={() => router.back()} disabled={submitting} variant="secondary" style={styles.cancelBtn} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primary, padding: spacing.md, paddingTop: 60, paddingBottom: 30 },
  back: { marginBottom: 12 },
  backText: { color: '#fff', fontSize: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  balanceCard: { margin: spacing.md, borderRadius: 12, elevation: 2, alignItems: 'center' },
  balanceLabel: { fontSize: 14, color: colors.muted, marginBottom: 4 },
  balanceValue: { fontSize: 32, fontWeight: 'bold', color: colors.primary },
  form: { padding: spacing.md },
  group: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  typeBtnTextActive: { color: '#fff' },
  dateBtn: { backgroundColor: colors.surface, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  dateBtnText: { fontSize: 16, color: colors.text },
  error: { marginTop: 4, fontSize: 12, color: colors.danger },
  estimateCard: { borderRadius: 8, marginBottom: 20, alignItems: 'center' },
  estimateLabel: { fontSize: 14, color: colors.muted, marginBottom: 4 },
  estimateValue: { fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: 4 },
  estimateNote: { fontSize: 12, color: colors.muted },
  textArea: { backgroundColor: colors.surface, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border, fontSize: 16, color: colors.text, minHeight: 100 },
  submitBtn: { marginBottom: 12 },
  cancelBtn: { marginBottom: 12 },
});
