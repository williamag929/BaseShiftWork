import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatScheduleTime } from '@/utils/date.utils';
import type { ScheduleShiftDto } from '@/types/api';

interface ShiftBannerProps {
  shift: ScheduleShiftDto;
  isClockedIn: boolean;
  locationName: string | null;
  onPress: () => void;
}

export function ShiftBanner({ shift, isClockedIn, locationName, onPress }: ShiftBannerProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.banner,
        isClockedIn ? styles.bannerOut : styles.bannerIn,
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={isClockedIn ? 'log-out-outline' : 'log-in-outline'}
        size={24}
        color="#fff"
        style={styles.icon}
      />
      <View style={styles.content}>
        <Text style={styles.title}>
          {isClockedIn ? 'You are on the clock' : 'Shift Pending — Tap to Clock In'}
        </Text>
        <Text style={styles.time}>
          {formatScheduleTime(shift.startDate)} — {formatScheduleTime(shift.endDate)}
        </Text>
        {!!locationName && (
          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.loc}>{locationName}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: -16, marginBottom: 8,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14,
    elevation: 4, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  bannerIn: { backgroundColor: '#27AE60' },
  bannerOut: { backgroundColor: '#E74C3C' },
  icon: { marginRight: 14 },
  content: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: '#fff' },
  time: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  loc: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
});
