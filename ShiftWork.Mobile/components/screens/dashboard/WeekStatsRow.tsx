import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/styles/tokens';

interface WeekStatsRowProps {
  loading: boolean;
  hoursThisWeek: number;
  shiftsThisWeek: number;
}

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  tint: string;
}

function StatCard({ icon, value, label, tint }: StatCardProps) {
  return (
    <View style={[styles.card, { borderTopWidth: 3, borderTopColor: tint }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${tint}18` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={[styles.value, { color: tint }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function WeekStatsRow({ loading, hoursThisWeek, shiftsThisWeek }: WeekStatsRowProps) {
  return (
    <View style={styles.row}>
      <StatCard
        icon="time-outline"
        value={loading ? '—' : hoursThisWeek.toFixed(1)}
        label="Hours This Week"
        tint={colors.primary}
      />
      <StatCard
        icon="calendar-outline"
        value={loading ? '—' : String(shiftsThisWeek)}
        label="Shifts This Week"
        tint={colors.success}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: 12, gap: 12 },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 13,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  value: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginBottom: 3 },
  label: { fontSize: 12, color: colors.muted, fontWeight: '500' },
});
