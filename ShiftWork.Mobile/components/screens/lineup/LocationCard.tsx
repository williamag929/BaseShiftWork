import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radius, spacing, touchTarget } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import { reasonKey, wallTime, type DraftFeedback, type LineupView } from '@/utils/lineup';
import type { LineupCrew, LineupShift } from '@/types/lineup';
import { PersonChip } from './PersonChip';
import { CrewPicker } from './CrewPicker';

type Props = {
  location: LineupView['locations'][number];
  /** Saved shifts queued for removal at this site. */
  removed?: LineupShift[];
  /** Person ids currently drafted (an undo would double-book them). */
  draftedIds?: number[];
  names?: Record<number, string>;
  /** Per-item commit feedback keyed p<personId> / s<shiftId>. */
  feedback?: Record<string, DraftFeedback>;
  active?: boolean;
  editable?: boolean;
  crews?: LineupCrew[];
  onActivate?: () => void;
  onRemoveSaved?: (shiftId: number) => void;
  onUnassign?: (personId: number) => void;
  onUndoRemoval?: (shiftId: number) => void;
  onPickCrew?: (crewId: number) => void;
};

function FeedbackText({ fb, testID }: { fb?: DraftFeedback; testID: string }) {
  const { t } = useTranslation();
  if (!fb || fb.messages.length === 0) return null;
  return (
    <View testID={testID} style={styles.feedback}>
      {fb.messages.map((m, i) => {
        const key = reasonKey(m);
        return (
          <Text key={i} style={fb.status === 'rejected' ? styles.fbError : styles.fbWarning}>
            {key ? t(key) : m}
          </Text>
        );
      })}
    </View>
  );
}

export function LocationCard({
  location, removed = [], draftedIds = [], names = {}, feedback = {}, active, editable, crews = [],
  onActivate, onRemoveSaved, onUnassign, onUndoRemoval, onPickCrew,
}: Props) {
  const { t } = useTranslation();
  const [crewOpen, setCrewOpen] = useState(false);
  const id = location.locationId;
  return (
    <Card style={[styles.card, active && styles.active]}>
      <PressableScale testID={`location-card-${id}`} accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onActivate} style={styles.header}>
        <Text style={styles.name}>{location.name}</Text>
        <Text style={styles.count}>{t('lineup.people_count', { count: location.count })}</Text>
      </PressableScale>
      <View style={styles.people}>
        {location.saved.map((s) => (
          <PersonChip
            key={`s${s.shiftId}`}
            testID={`saved-chip-${s.shiftId}`}
            name={s.name}
            detail={`${wallTime(s.start)}–${wallTime(s.end)}`}
            onPress={editable ? () => onRemoveSaved?.(s.shiftId) : undefined}
          />
        ))}
        {location.drafted.map((d) => {
          const fb = feedback[`p${d.personId}`];
          return (
            <View key={`d${d.personId}`}>
              <PersonChip
                testID={`drafted-chip-${d.personId}`}
                variant={fb ? (fb.status === 'rejected' ? 'rejected' : 'warning') : 'drafted'}
                name={names[d.personId] || t('lineup.unknown_person')}
                detail={`${wallTime(d.start)}–${wallTime(d.end)}`}
                onPress={editable ? () => onUnassign?.(d.personId) : undefined}
              />
              <FeedbackText testID={`feedback-p${d.personId}`} fb={fb} />
            </View>
          );
        })}
        {removed.map((s) => {
          const fb = feedback[`s${s.shiftId}`];
          return (
            <View key={`r${s.shiftId}`}>
              <PersonChip
                testID={`removed-chip-${s.shiftId}`}
                variant="removed"
                name={s.name}
                detail={`${wallTime(s.start)}–${wallTime(s.end)}`}
                onPress={editable && !draftedIds.includes(s.personId) ? () => onUndoRemoval?.(s.shiftId) : undefined}
              />
              <FeedbackText testID={`feedback-s${s.shiftId}`} fb={fb} />
            </View>
          );
        })}
      </View>
      {editable && crews.length > 0 && (
        <View>
          <PressableScale testID={`add-crew-${id}`} accessibilityRole="button" onPress={() => setCrewOpen((o) => !o)} style={styles.crewBtn}>
            <Text style={styles.crewBtnText}>{t('lineup.add_crew')}</Text>
          </PressableScale>
          {crewOpen && (
            <CrewPicker
              crews={crews}
              onPick={(crewId) => {
                setCrewOpen(false);
                onPickCrew?.(crewId);
              }}
            />
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  active: { borderWidth: 2, borderColor: colors.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, minHeight: touchTarget.min },
  name: { fontSize: 17, fontWeight: '600', color: colors.text, flexShrink: 1 },
  count: { fontSize: 13, color: colors.muted },
  feedback: { marginBottom: spacing.sm, marginRight: spacing.sm, maxWidth: 220 },
  fbError: { fontSize: 12, color: colors.danger },
  fbWarning: { fontSize: 12, color: colors.warning },
  people: { flexDirection: 'row', flexWrap: 'wrap' },
  crewBtn: {
    minHeight: touchTarget.min, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: spacing.md,
    borderRadius: radius.lg, backgroundColor: colors.primaryLight,
  },
  crewBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
