import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, Skeleton } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { DateStrip } from '@/components/screens/lineup/DateStrip';
import { LocationCard } from '@/components/screens/lineup/LocationCard';
import { Bench } from '@/components/screens/lineup/Bench';
import { CommitBar } from '@/components/screens/lineup/CommitBar';
import { ResultsSheet } from '@/components/screens/lineup/ResultsSheet';
import { UnavailableList } from '@/components/screens/lineup/UnavailableList';
import { useLineup, useLineupCommit } from '@/hooks/useLineup';
import { useIsOffline } from '@/hooks/useNetworkStatus';
import { useAuthStore } from '@/store/authStore';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/useToast';
import { useLineupDraftStore } from '@/store/lineupDraftStore';
import { colors, radius, spacing } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import { crewFill, localToday, mergeLineup } from '@/utils/lineup';
import type { LineupPerson } from '@/types/lineup';

const isForbidden = (error: unknown): boolean => {
  const e = error as { statusCode?: number; response?: { status?: number } } | null;
  return (e?.statusCode ?? e?.response?.status) === 403;
};

export default function LineupScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState<string>(() => localToday());
  const { data, isLoading, isError, error, refetch } = useLineup(date);

  const companyId = useAuthStore((s) => s.companyId);
  const setScope = useLineupDraftStore((s) => s.setScope);
  const assignments = useLineupDraftStore((s) => s.assignments);
  const removals = useLineupDraftStore((s) => s.removals);
  const feedback = useLineupDraftStore((s) => s.feedback);
  const { assign, assignMany, unassign, removeShift, undoRemoval, acceptWarnings } = useLineupDraftStore.getState();
  const { commit, isPending, results, reset } = useLineupCommit();
  const networkOffline = useIsOffline(); // null = unknown
  const offline = networkOffline === true;
  const publishBlocked = networkOffline !== false; // unknown blocks publishing too
  const [sheetOpen, setSheetOpen] = useState(false);
  const toast = useToast();
  const hasEditPerm = usePermission('lineup.edit');
  const hasAllLocations = usePermission('lineup.all-locations');
  const [activeId, setActiveId] = useState<number | null>(null);

  // Keep the draft store's date in step with the screen.
  // The draft is scoped to company + date; either changing discards it (also covers sign-in as another user).
  useEffect(() => {
    setScope(companyId, date);
  }, [companyId, date, setScope]);

  // Refetch on focus only; a date change already fetches through the query key.
  useFocusEffect(
    useCallback(() => {
      if (companyId) refetch(); // refetch() ignores `enabled`, so guard here
    }, [companyId, refetch]),
  );

  // Drop draft items the server no longer knows (lost-response removals, locations that left scope).
  const { prune } = useLineupDraftStore.getState();
  useEffect(() => {
    if (!data || data.date !== date || isPending) return;
    if (useLineupDraftStore.getState().date !== date) return;
    prune(
      data.locations.flatMap((l) => l.shifts.map((s) => s.shiftId)),
      data.locations.map((l) => l.locationId),
    );
  }, [data, date, isPending, prune]);

  const view = useMemo(
    () => (data ? mergeLineup(data, { assignments, removals, feedback }) : null),
    [data, assignments, removals, feedback],
  );

  const canEditNow = !!data?.canEdit && hasEditPerm;
  // Every draft edit is locked while a commit is in flight so the request cannot diverge from the draft.
  const editable = canEditNow && !isPending;
  const firstId = view?.locations[0]?.locationId ?? null;
  // Fall back to the first site when the active one disappears (e.g. after a refetch).
  const effectiveId =
    view && view.locations.some((l) => l.locationId === activeId) ? activeId : firstId;
  const activeLocation = view?.locations.find((l) => l.locationId === effectiveId) ?? null;

  const names = useMemo(() => {
    const m: Record<number, string> = {};
    data?.bench.forEach((p) => { m[p.personId] = p.name; });
    data?.unavailable.forEach((p) => { m[p.personId] = p.name; });
    data?.locations.forEach((l) => l.shifts.forEach((s) => { m[s.personId] = s.name; }));
    return m;
  }, [data]);
  const nameFor = (personId: number): string => names[personId] || t('lineup.unknown_person');
  const shiftNameFor = (shiftId: number): string => {
    for (const l of data?.locations ?? []) {
      const s = l.shifts.find((x) => x.shiftId === shiftId);
      if (s?.name) return s.name;
    }
    return '';
  };

  const runCommit = async () => {
    if (publishBlocked || isPending) return;
    try {
      await commit();
      setSheetOpen(true);
    } catch {
      // Network/server failure: the draft is untouched so the user can retry.
      toast.error(t('lineup.commit_failed'));
    }
  };

  const onConfirm = (personIds: number[]) => {
    acceptWarnings(personIds);
    runCommit();
  };

  // A saved shift of this person at this same site that is queued for removal: undoing beats delete + recreate.
  const queuedRemovalAt = (personId: number, locationId: number): number | null => {
    const loc = data?.locations.find((l) => l.locationId === locationId);
    return loc?.shifts.find((x) => x.personId === personId && removals.includes(x.shiftId))?.shiftId ?? null;
  };

  const noDefaultShift = () =>
    toast.warning(t(hasAllLocations ? 'lineup.no_default_shift_all' : 'lineup.no_default_shift_foreman'));

  const onBenchPress = (p: LineupPerson) => {
    if (!editable) return;
    if (!activeLocation) {
      toast.info(t('lineup.pick_site_first'));
      return;
    }
    if (!activeLocation.defaultShift) {
      noDefaultShift();
      return;
    }
    const queued = queuedRemovalAt(p.personId, activeLocation.locationId);
    if (queued != null) undoRemoval(queued);
    else assign(p.personId, activeLocation.locationId, activeLocation.defaultShift);
  };

  const onPickCrew = (locationId: number, crewId: number) => {
    if (!view || !editable) return;
    const loc = view.locations.find((l) => l.locationId === locationId);
    if (!loc) return;
    if (!loc.defaultShift) {
      noDefaultShift();
      return;
    }
    const { memberIds, busy } = crewFill(view, crewId);
    const total = view.crews.find((c) => c.crewId === crewId)?.memberIds.length ?? 0;
    const toAssign: number[] = [];
    memberIds.forEach((id) => {
      const queued = queuedRemovalAt(id, locationId);
      if (queued != null) undoRemoval(queued);
      else toAssign.push(id);
    });
    if (toAssign.length) assignMany(toAssign, locationId, loc.defaultShift);
    toast.info(t('lineup.crew_added', { added: memberIds.length, total, busy }));
  };

  const changeDate = (next: string) => {
    if (isPending) return;
    reset();
    setSheetOpen(false);
    setScope(companyId, next);
    setDate(next);
  };

  let body: React.ReactNode;
  if (isError) {
    body = isForbidden(error) ? (
      <EmptyState title={t('lineup.title')} message={t('lineup.empty_scope')} icon="lock-closed-outline" />
    ) : (
      <EmptyState
        title={t('lineup.title')}
        message={t('common.error')}
        icon="alert-circle-outline"
        action={
          <PressableScale accessibilityRole="button" onPress={() => refetch()} style={styles.retry}>
            <Text style={styles.retryText}>{t('lineup.retry')}</Text>
          </PressableScale>
        }
      />
    );
  } else if (!isLoading && (!data || !view)) {
    // Query disabled (no company) or no data: neutral state instead of an endless skeleton.
    body = <EmptyState title={t('lineup.title')} message={t('lineup.empty_scope')} icon="people-outline" />;
  } else if (isLoading || !data || !view) {
    body = (
      <View>
        <Skeleton width="100%" height={96} borderRadius={radius.lg} style={styles.gap} />
        <Skeleton width="100%" height={96} borderRadius={radius.lg} />
      </View>
    );
  } else if (view.locations.length === 0) {
    body = <EmptyState title={t('lineup.title')} message={t('lineup.empty_scope')} icon="people-outline" />;
  } else {
    body = (
      <View>
        {!data.canEdit && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{t('lineup.read_only')}</Text>
          </View>
        )}
        {view.locations.map((l) => (
          <LocationCard
            key={l.locationId}
            location={l}
            removed={(data.locations.find((x) => x.locationId === l.locationId)?.shifts ?? []).filter((s) => removals.includes(s.shiftId))}
            draftedIds={assignments.map((a) => a.personId)}
            names={names}
            feedback={feedback}
            active={l.locationId === effectiveId}
            editable={editable}
            crews={view.crews}
            onActivate={() => setActiveId(l.locationId)}
            onRemoveSaved={removeShift}
            onUnassign={unassign}
            onUndoRemoval={undoRemoval}
            onPickCrew={(crewId) => onPickCrew(l.locationId, crewId)}
          />
        ))}
        <Bench people={view.bench} onPress={editable ? onBenchPress : undefined} />
        <UnavailableList people={view.unavailable} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }}
      >
        <Text style={styles.title}>{t('lineup.title')}</Text>
        {offline && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{t('lineup.offline')}</Text>
          </View>
        )}
        <DateStrip date={date} onChange={changeDate} confirmDiscard={(view?.changeCount ?? 0) > 0} disabled={isPending} />
        {body}
      </ScrollView>
      {canEditNow && (
        <CommitBar count={view?.changeCount ?? 0} pending={isPending} offline={publishBlocked} onCommit={runCommit} />
      )}
      {sheetOpen && results && (
        <ResultsSheet
          results={results}
          nameFor={nameFor}
          shiftNameFor={shiftNameFor}
          pending={isPending || publishBlocked}
          onConfirm={onConfirm}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  gap: { marginBottom: spacing.md },
  banner: { backgroundColor: colors.warningLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  bannerText: { fontSize: 14, color: colors.warning },
  retry: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primary },
  retryText: { color: colors.onPrimary, fontWeight: '600', fontSize: 15 },
});
