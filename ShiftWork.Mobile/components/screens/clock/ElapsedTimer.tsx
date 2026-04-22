import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/styles/tokens';

interface ElapsedTimerProps {
  seconds: number;
}

function fmtHMS(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function ElapsedTimer({ seconds }: ElapsedTimerProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <Ionicons name="pulse" size={14} color={colors.success} />
        <Text style={styles.label}>On Clock</Text>
      </View>
      <Text style={styles.time}>{fmtHMS(seconds)}</Text>
      <Text style={styles.caption}>hours : minutes : seconds</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(52,199,89,0.14)',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 12,
  },
  label: { fontSize: 12, fontWeight: '700', color: colors.success, letterSpacing: 0.5, textTransform: 'uppercase' },
  time: { fontSize: 46, fontWeight: '700', color: colors.text, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 11, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
});
