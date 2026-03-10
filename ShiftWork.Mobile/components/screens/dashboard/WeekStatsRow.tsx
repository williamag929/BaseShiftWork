import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/components/ui';
import { colors, spacing } from '@/styles/tokens';

interface WeekStatsRowProps {
  loading: boolean;
  hoursThisWeek: number;
  shiftsThisWeek: number;
}

export function WeekStatsRow({ loading, hoursThisWeek, shiftsThisWeek }: WeekStatsRowProps) {
  return (
    <View style={styles.row}>
      <Card style={styles.card}>
        <Text style={styles.value}>{loading ? '—' : hoursThisWeek.toFixed(2)}</Text>
        <Text style={styles.label}>Hours This Week</Text>
      </Card>
      <Card style={styles.card}>
        <Text style={styles.value}>{loading ? '—' : shiftsThisWeek}</Text>
        <Text style={styles.label}>Shifts This Week</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: spacing.lg, gap: 12 },
  card: { flex: 1, padding: 20 },
  value: { fontSize: 32, fontWeight: 'bold', color: colors.primary, marginBottom: 4 },
  label: { fontSize: 12, color: colors.muted },
});
