import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, spacing, radius } from '@/styles/tokens';

interface ContentInboxSectionProps {
  unreadBulletins: number;
  pendingSafety: number;
  onOpenBulletins: () => void;
  onOpenSafety: () => void;
  onOpenDailyReport: () => void;
}

interface ContentCardProps {
  title: string;
  subtitle: string;
  count?: number;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  onPress: () => void;
  delay: number;
}

function ContentCard({ title, subtitle, count, icon, tint, onPress, delay }: ContentCardProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(280)} style={{ flex: 1 }}>
      <PressableScale
        style={styles.card}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        <View style={styles.headRow}>
          <View style={[styles.iconWrap, { backgroundColor: `${tint}1A` }]}>
            <Ionicons name={icon} size={18} color={tint} />
          </View>
          {typeof count === 'number' && count > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{count}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </PressableScale>
    </Animated.View>
  );
}

export function ContentInboxSection({
  unreadBulletins,
  pendingSafety,
  onOpenBulletins,
  onOpenSafety,
  onOpenDailyReport,
}: ContentInboxSectionProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Inbox & Reports</Text>
      <View style={styles.row}>
        <ContentCard
          title="Bulletins"
          subtitle={unreadBulletins > 0 ? 'Unread updates waiting' : 'All caught up'}
          count={unreadBulletins}
          icon="megaphone-outline"
          tint={colors.primary}
          onPress={onOpenBulletins}
          delay={40}
        />
        <ContentCard
          title="Safety"
          subtitle={pendingSafety > 0 ? 'Acknowledgment required' : 'No pending actions'}
          count={pendingSafety}
          icon="shield-checkmark-outline"
          tint={colors.warning}
          onPress={onOpenSafety}
          delay={90}
        />
      </View>
      <Animated.View entering={FadeInDown.delay(140).duration(280)}>
        <PressableScale
          style={styles.reportCard}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onOpenDailyReport();
          }}
        >
          <View style={[styles.iconWrap, { backgroundColor: `${colors.success}1A` }]}>
            <Ionicons name="clipboard-outline" size={18} color={colors.success} />
          </View>
          <View style={styles.reportBody}>
            <Text style={styles.title}>Daily Report</Text>
            <Text style={styles.subtitle}>Add notes and attach photos for today</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingBottom: 10, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 12,
    minHeight: 104,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    justifyContent: 'space-between',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reportBody: { flex: 1 },
});
