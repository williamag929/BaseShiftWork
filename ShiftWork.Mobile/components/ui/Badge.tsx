import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/styles/theme';

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md';

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
};

// iOS-accurate semantic fills
const toneMap: Record<BadgeTone, { bg: string; text: string; dot: string }> = {
  success: { bg: 'rgba(52,199,89,0.14)',   text: '#248A3D', dot: colors.success },
  warning: { bg: 'rgba(255,149,0,0.14)',   text: '#B25000', dot: colors.warning },
  danger:  { bg: 'rgba(255,59,48,0.14)',   text: '#C93028', dot: colors.danger },
  info:    { bg: 'rgba(0,122,255,0.14)',   text: '#0056CC', dot: colors.primary },
  neutral: { bg: 'rgba(120,120,128,0.12)', text: colors.muted, dot: colors.muted },
};

export default function Badge({ label, tone = 'neutral', size = 'md', dot = false }: BadgeProps) {
  const t = toneMap[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, size === 'sm' && styles.sm]}>
      {dot && <View style={[styles.dot, { backgroundColor: t.dot }]} />}
      <Text style={[styles.text, { color: t.text }, size === 'sm' && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    gap: 4,
  },
  sm: { paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: {
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  textSm: { fontSize: 11 },
});
