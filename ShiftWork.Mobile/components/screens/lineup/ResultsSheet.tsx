import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radius, spacing, touchTarget } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import type { LineupCommitResult } from '@/types/lineup';

type Props = {
  results: LineupCommitResult[];
  nameFor: (personId: number) => string;
  /** Label for a result that has only a shift id (e.g. a rejected removal). */
  shiftNameFor?: (shiftId: number) => string;
  onConfirm: (personIds: number[]) => void;
  onClose: () => void;
  /** Disables the confirm buttons while a commit is in flight. */
  pending?: boolean;
};

export function ResultsSheet({ results, nameFor, shiftNameFor, onConfirm, onClose, pending = false }: Props) {
  const { t } = useTranslation();
  const count = (s: LineupCommitResult['status']) => results.filter((r) => r.status === s).length;
  const rejected = results.filter((r) => r.status === 'rejected');
  const needs = results.filter((r) => r.status === 'needs-confirmation');

  const labelOf = (r: LineupCommitResult): string => {
    if (r.personId != null) return nameFor(r.personId) || t('lineup.unknown_person');
    if (r.shiftId != null) return shiftNameFor?.(r.shiftId) || t('lineup.unknown_shift', { id: r.shiftId });
    return t('lineup.unknown_person');
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('lineup.results_title')}</Text>
            <PressableScale testID="results-close" accessibilityRole="button" accessibilityLabel={t('common.close_aria')} onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>{t('common.close')}</Text>
            </PressableScale>
          </View>
          <ScrollView>
            <View style={styles.summaryRow}>
              <Text style={styles.summary}>{t('lineup.created', { count: count('created') })}</Text>
              <Text style={styles.summary}>{t('lineup.removed', { count: count('removed') })}</Text>
              <Text style={styles.summary}>{t('lineup.unchanged', { count: count('unchanged') })}</Text>
            </View>
            {rejected.length > 0 && <Text style={styles.section}>{t('lineup.rejected')}</Text>}
            {rejected.map((r, i) => (
              <View key={`rej-${r.personId ?? 's' + r.shiftId}-${i}`} style={styles.row}>
                <Text style={styles.name}>{labelOf(r)}</Text>
                {r.errors.map((e, j) => (
                  <Text key={j} style={styles.error}>{e}</Text>
                ))}
              </View>
            ))}
            {needs.length > 0 && <Text style={styles.section}>{t('lineup.needs_confirmation')}</Text>}
            {needs.map((r, i) => (
              <View key={`nc-${r.personId}-${i}`} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{labelOf(r)}</Text>
                  {r.warnings.map((w, j) => (
                    <Text key={j} style={styles.warning}>{w}</Text>
                  ))}
                </View>
                {r.personId != null && (
                  <PressableScale
                    testID={`confirm-${r.personId}`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: pending }}
                    disabled={pending}
                    onPress={() => onConfirm([r.personId as number])}
                    style={[styles.confirm, pending && styles.disabled]}
                  >
                    <Text style={styles.confirmText}>{t('lineup.confirm')}</Text>
                  </PressableScale>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.fill },
  sheet: { maxHeight: '75%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, flexShrink: 1 },
  close: { minHeight: touchTarget.min, minWidth: touchTarget.min, justifyContent: 'center', alignItems: 'center' },
  closeText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  summary: { fontSize: 15, color: colors.textSecondary, marginRight: spacing.lg },
  section: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1, marginRight: spacing.md },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  error: { fontSize: 14, color: colors.danger, marginTop: 2 },
  warning: { fontSize: 14, color: colors.warning, marginTop: 2 },
  confirm: { minHeight: touchTarget.min, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.primary, justifyContent: 'center' },
  confirmText: { color: colors.onPrimary, fontWeight: '600', fontSize: 15 },
  disabled: { opacity: 0.5 },
});
