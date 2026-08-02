import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { Controller } from 'react-hook-form';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card, Button } from '@/components/ui';
import { colors, spacing } from '@/styles/tokens';
import { useTimeOffForm } from '@/hooks/useTimeOffForm';
import { timeOffTypes } from '@/utils/schemas/timeoff';
import { useTranslation } from '@/i18n';

export default function TimeOffRequestScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { form, ptoBalance, estimatedHours, businessDays, showStartPicker, setShowStartPicker, showEndPicker, setShowEndPicker, submitting, onSubmit, onStartDateChange, onEndDateChange, formatDate } = useTimeOffForm();
  const { control, handleSubmit, watch, formState: { errors } } = form;
  const startDate = watch('startDate');
  const endDate = watch('endDate');

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>{t('time_off.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('time_off.title')}</Text>
      </View>

      {ptoBalance !== null && (
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('time_off.balance_label')}</Text>
          <Text style={styles.balanceValue}>{t('time_off.balance_hours', { value: ptoBalance.toFixed(2) })}</Text>
        </Card>
      )}

      <View style={styles.form}>
        <View style={styles.group}>
          <Text style={styles.label}>{t('time_off.type_label')}</Text>
          <Controller
            control={control}
            name="type"
            render={({ field: { value, onChange } }) => (
              <View style={styles.typeRow}>
                {timeOffTypes.map((type) => (
                  <Pressable key={type} style={[styles.typeBtn, value === type && styles.typeBtnActive]} onPress={() => onChange(type)}>
                    <Text style={[styles.typeBtnText, value === type && styles.typeBtnTextActive]}>{type}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>{t('time_off.start_date')}</Text>
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
          <Text style={styles.label}>{t('time_off.end_date')}</Text>
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
          <Text style={styles.estimateLabel}>{t('time_off.estimated_hours')}</Text>
          <Text style={styles.estimateValue}>{t('time_off.balance_hours', { value: estimatedHours })}</Text>
          <Text style={styles.estimateNote}>{t('time_off.business_days', { days: businessDays })}</Text>
        </Card>

        <View style={styles.group}>
          <Text style={styles.label}>{t('time_off.reason_label')}</Text>
          <Controller
            control={control}
            name="reason"
            render={({ field: { value, onChange } }) => (
              <TextInput
                style={styles.textArea}
                value={value}
                onChangeText={onChange}
                placeholder={t('time_off.reason_placeholder')}
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            )}
          />
        </View>

        <Button
          label={submitting ? t('time_off.submitting') : t('time_off.submit')}
          onPress={handleSubmit(onSubmit)}
          loading={submitting}
          variant="primary"
          style={styles.submitBtn}
        />
        <Button
          label={t('common.cancel')}
          onPress={() => router.back()}
          disabled={submitting}
          variant="secondary"
          style={styles.cancelBtn}
        />
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
