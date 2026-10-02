import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, Skeleton } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { DateStrip } from '@/components/screens/lineup/DateStrip';
import { LocationCard } from '@/components/screens/lineup/LocationCard';
import { Bench } from '@/components/screens/lineup/Bench';
import { UnavailableList } from '@/components/screens/lineup/UnavailableList';
import { useLineup } from '@/hooks/useLineup';
import { useLineupDraftStore } from '@/store/lineupDraftStore';
import { colors, radius, spacing } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import { localToday, mergeLineup } from '@/utils/lineup';

const isForbidden = (error: unknown): boolean => {
  const e = error as { statusCode?: number; response?: { status?: number } } | null;
  return (e?.statusCode ?? e?.response?.status) === 403;
};

export default function LineupScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState<string>(() => localToday());
  const { data, isLoading, isError, error, refetch } = useLineup(date);

  const setDraftDate = useLineupDraftStore((s) => s.setDate);
  const assignments = useLineupDraftStore((s) => s.assignments);
  const removals = useLineupDraftStore((s) => s.removals);
  const feedback = useLineupDraftStore((s) => s.feedback);

  // Keep the draft store's date in step with the screen.
  useEffect(() => {
    setDraftDate(date);
  }, [date, setDraftDate]);

  // Refetch on focus only; a date change already fetches through the query key.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const view = useMemo(
    () => (data ? mergeLineup(data, { assignments, removals, feedback }) : null),
    [data, assignments, removals, feedback],
  );

  const changeDate = (next: string) => {
    setDraftDate(next);
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
          <LocationCard key={l.locationId} location={l} />
        ))}
        <Bench people={view.bench} />
        <UnavailableList people={view.unavailable} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }}
    >
      <Text style={styles.title}>{t('lineup.title')}</Text>
      <DateStrip date={date} onChange={changeDate} confirmDiscard={(view?.changeCount ?? 0) > 0} />
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  gap: { marginBottom: spacing.md },
  banner: { backgroundColor: colors.warningLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  bannerText: { fontSize: 14, color: colors.warning },
  retry: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primary },
  retryText: { color: colors.onPrimary, fontWeight: '600', fontSize: 15 },
});
