import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, spacing, radius } from '@/styles/tokens';

interface QuickActionsProps {
  isClockedIn: boolean;
  onClock: () => void;
  onSchedule: () => void;
  onTimeOff: () => void;
}

interface ActionItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  onPress: () => void;
}

function ActionCard({ icon, label, tint, onPress }: ActionItem) {
  return (
    <PressableScale
      style={styles.card}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${tint}18` }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </PressableScale>
  );
}

export function QuickActions({ isClockedIn, onClock, onSchedule, onTimeOff }: QuickActionsProps) {
  const actions: ActionItem[] = [
    {
      icon: isClockedIn ? 'stop-circle' : 'play-circle',
      label: isClockedIn ? 'Clock Out' : 'Clock In',
      tint: isClockedIn ? colors.danger : colors.success,
      onPress: onClock,
    },
    { icon: 'calendar', label: 'Schedule', tint: colors.primary, onPress: onSchedule },
    { icon: 'airplane', label: 'Time Off',  tint: '#AF52DE', onPress: onTimeOff },
  ];

  return (
    <View style={styles.row}>
      {actions.map((a, i) => (
        <Animated.View key={a.label} entering={FadeInDown.delay(i * 60).duration(280)} style={{ flex: 1 }}>
          <ActionCard {...a} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, paddingBottom: 8 },
  card: {
    flex: 1, backgroundColor: colors.surface,
    paddingVertical: 14, borderRadius: radius.xl,
    alignItems: 'center', justifyContent: 'center', gap: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, color: colors.text, fontWeight: '600' },
});
