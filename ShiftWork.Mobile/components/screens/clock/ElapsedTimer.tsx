import { Text, StyleSheet } from 'react-native';
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
  return <Text style={styles.elapsed}>Time on clock: {fmtHMS(seconds)}</Text>;
}

const styles = StyleSheet.create({
  elapsed: { marginTop: 8, color: colors.success, fontWeight: '600' },
});
