import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, spacing } from '@/styles/tokens';
import { formatDate, formatScheduleTime } from '@/utils/date.utils';
import type { ScheduleShiftDto } from '@/types/api';

interface ShiftDetailModalProps {
  visible: boolean;
  shift: ScheduleShiftDto | null;
  timeZoneId?: string | null;
  onClose: () => void;
}

export function ShiftDetailModal({ visible, shift, timeZoneId, onClose }: ShiftDetailModalProps) {
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!shift) return;
    setStatus(shift.status ?? '');
    setNotes(shift.notes ?? '');
  }, [shift?.scheduleShiftId, shift?.status, shift?.notes]);

  if (!shift) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Shift Details</Text>
          <Text style={styles.meta}>Shift #{shift.scheduleShiftId}</Text>
          <Text style={styles.meta}>{formatDate(shift.startDate)}</Text>
          <Text style={styles.meta}>{formatScheduleTime(shift.startDate, timeZoneId ?? undefined)} - {formatScheduleTime(shift.endDate, timeZoneId ?? undefined)}</Text>

          <Text style={styles.label}>Status</Text>
          <TextInput
            value={status}
            editable={false}
            style={styles.input}
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={notes}
            editable={false}
            style={[styles.input, styles.textArea]}
            multiline
            placeholder="No notes"
            placeholderTextColor={colors.muted}
          />

          {/* TODO: re-enable edit/save flow once shift edit UX/permissions are finalized. */}

          <View style={styles.row}>
            <Pressable style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  meta: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 4,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    color: colors.text,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.background,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  row: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryText: {
    color: colors.text,
    fontWeight: '600',
  },
});
