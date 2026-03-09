import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/styles/tokens';

interface QuickActionsProps {
  isClockedIn: boolean;
  onClock: () => void;
  onSchedule: () => void;
  onTimeOff: () => void;
}

export function QuickActions({ isClockedIn, onClock, onSchedule, onTimeOff }: QuickActionsProps) {
  const actions = [
    { icon: 'time' as const, label: isClockedIn ? 'Clock Out' : 'Clock In', onPress: onClock },
    { icon: 'calendar' as const, label: 'Schedule', onPress: onSchedule },
    { icon: 'airplane' as const, label: 'Time Off', onPress: onTimeOff },
  ];
  return (
    <View style={styles.row}>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
          onPress={a.onPress}
        >
          <Ionicons name={a.icon} size={18} color={colors.primary} />
          <Text style={styles.label}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: spacing.lg, paddingBottom: 8 },
  card: {
    flex: 1, backgroundColor: colors.surface,
    paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    elevation: 1, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2,
  },
  label: { fontSize: 12, color: colors.primary, fontWeight: '600' },
});
