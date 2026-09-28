import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { useScheduleGrid } from '@/hooks/useScheduleGrid';
import ScheduleGrid from '@/components/ScheduleGrid';
import { colors } from '@/styles/theme';
import { EmptyState } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/utils/logger';
import { useTranslation } from '@/i18n';

export default function ScheduleGridScreen() {
  const { companyId } = useAuthStore();
  const { t } = useTranslation();
  const toast = useToast();
  const { loading, error, data, filters, setFilters, refresh } = useScheduleGrid({
    companyId,
    locationId: undefined,
  });

  const handleShiftPress = (shift: any) => {
    toast.info(`${shift.personName} · ${shift.startTime} - ${shift.endTime} · ${shift.status}`);
  };

  const handleAddShift = (personId: number, date: Date) => {
    Alert.alert(
      'Add Shift',
      `Add shift for Person ${personId} on ${date.toLocaleDateString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add', onPress: () => logger.log('[ScheduleGrid] Add shift tapped') },
      ]
    );
  };

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('schedule_grid.loading')}</Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.centered}>
        <EmptyState title={t('schedule_grid.unable_to_load')} message={error} icon="alert-circle-outline" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScheduleGrid
        data={data}
        filters={filters}
        onFiltersChange={setFilters}
        onShiftPress={handleShiftPress}
        onAddShift={handleAddShift}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 16, color: colors.muted },
});
