import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Skeleton } from '@/components/ui/Skeleton';
import { registrationService, SandboxStatusResponse } from '@/services/registration.service';
import { colors, spacing, radius } from '@/styles/tokens';
import { useToast } from '@/hooks/useToast';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');

  useEffect(() => {
    AsyncStorage.getItem('onboarding_company_id').then(id => {
      if (id) setCompanyId(id);
      else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (companyId) loadStatus();
  }, [companyId]);

  const loadStatus = async () => {
    try {
      const status = await registrationService.getSandboxStatus(companyId);
      setSandboxStatus(status);
    } catch {
      toast.error('Could not load sandbox status.');
    } finally {
      setLoading(false);
    }
  };

  const handleHide = async () => {
    setActionLoading(true);
    try {
      await registrationService.hideSandboxData(companyId);
      toast.success('Demo data hidden. Restore from Settings anytime.');
      await loadStatus();
    } catch {
      toast.error('Failed to hide demo data.');
    } finally { setActionLoading(false); }
  };

  const handleReset = async () => {
    setActionLoading(true);
    try {
      await registrationService.resetSandboxData(companyId);
      toast.success('Demo data reset to defaults.');
      await loadStatus();
    } catch {
      toast.error('Failed to reset demo data.');
    } finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await registrationService.deleteSandboxData(companyId);
      toast.success('Demo data removed. Workspace is clean.');
      setSandboxStatus({ hasSandboxData: false, sandboxPersonCount: 0, sandboxAreaCount: 0, sandboxLocationCount: 0 });
    } catch {
      toast.error('Failed to delete demo data.');
    } finally { setActionLoading(false); }
  };

  const goToDashboard = () => {
    AsyncStorage.multiRemove(['onboarding_company_id', 'onboarding_plan']);
    router.replace('/(tabs)/dashboard');
  };

  if (loading) {
    return (
      <View style={styles.loadingCenter}>
        <Skeleton width={200} height={24} borderRadius={8} style={{ marginBottom: 12 }} />
        <Skeleton width={280} height={16} borderRadius={6} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style="dark" />

      {/* Hero */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="sparkles" size={36} color={colors.primary} />
        </View>
        <Text style={styles.heroTitle}>Welcome to ShiftWork!</Text>
        <Text style={styles.heroSub}>Your account is ready. Let's get you started.</Text>
      </Animated.View>

      {/* Sandbox section */}
      {sandboxStatus?.hasSandboxData && (
        <Animated.View entering={FadeInDown.delay(100).duration(350)} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>Demo Data</Text>
            </View>
            <Text style={styles.cardTitle}>Sample data included</Text>
            <Text style={styles.cardBody}>
              We've added demo employees, a location, and an area so you can explore ShiftWork right away.
            </Text>
          </View>

          {/* Count row */}
          <View style={styles.countRow}>
            {[
              { icon: 'people-outline', count: sandboxStatus.sandboxPersonCount, label: 'Employees' },
              { icon: 'location-outline', count: sandboxStatus.sandboxLocationCount, label: 'Locations' },
              { icon: 'grid-outline', count: sandboxStatus.sandboxAreaCount, label: 'Areas' },
            ].map(({ icon, count, label }) => (
              <View key={label} style={styles.countItem}>
                <Ionicons name={icon as any} size={20} color={colors.primary} />
                <Text style={styles.countNum}>{count}</Text>
                <Text style={styles.countLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Actions */}
          {([
            { label: 'Hide demo data', color: colors.muted,    onPress: handleHide   },
            { label: 'Reset to defaults', color: colors.warning, onPress: handleReset  },
            { label: 'Remove permanently', color: colors.danger,  onPress: handleDelete },
          ] as const).map(({ label, color, onPress }) => (
            <Pressable
              key={label}
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.65 }]}
              onPress={onPress}
              disabled={actionLoading}
            >
              <Text style={[styles.actionText, { color }]}>{label}</Text>
              <Ionicons name="chevron-forward" size={16} color={color} />
            </Pressable>
          ))}
        </Animated.View>
      )}

      {sandboxStatus && !sandboxStatus.hasSandboxData && (
        <Animated.View entering={FadeInDown.delay(100).duration(350)} style={[styles.card, styles.cleanCard]}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.cleanText}>Your workspace is clean and ready for real data.</Text>
        </Animated.View>
      )}

      {/* Plan card */}
      <Animated.View entering={FadeInDown.delay(160).duration(350)} style={styles.card}>
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>Free Plan</Text>
        </View>
        <Text style={styles.cardTitle}>Upgrade for more power</Text>
        <Text style={styles.cardBody}>
          Advanced scheduling, analytics, multi-location support, and more.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.75 }]}
          onPress={() => router.push('/(tabs)/upgrade')}
        >
          <Text style={styles.outlineBtnText}>Explore Pro Features</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </Pressable>
      </Animated.View>

      {/* CTA */}
      <Animated.View entering={FadeInDown.delay(220).duration(350)}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          onPress={goToDashboard}
        >
          <Text style={styles.primaryBtnText}>Go to Dashboard</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  // Hero
  hero: { alignItems: 'center', marginBottom: 28 },
  heroIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  heroTitle: { fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.5, marginBottom: 8 },
  heroSub: { fontSize: 15, color: colors.muted, textAlign: 'center' },

  // Cards
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    paddingHorizontal: 20, paddingVertical: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cleanCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cleanText: { fontSize: 15, color: colors.success, fontWeight: '500', flex: 1 },
  cardHeader: { marginBottom: 16 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 6 },
  cardBody: { fontSize: 14, color: colors.muted, lineHeight: 20 },

  // Demo badge
  demoBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(0,178,204,0.12)',
    borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
  },
  demoBadgeText: { fontSize: 12, fontWeight: '700', color: '#0BB9CF' },

  // Count row
  countRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  countItem: { alignItems: 'center', gap: 4 },
  countNum: { fontSize: 26, fontWeight: '700', color: colors.primary },
  countLabel: { fontSize: 12, color: colors.muted },

  divider: { height: 0.5, backgroundColor: colors.border, marginBottom: 8 },

  // Sandbox action rows
  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  actionText: { fontSize: 15, fontWeight: '500' },

  // Plan
  planBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,149,0,0.12)',
    borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
  },
  planBadgeText: { fontSize: 12, fontWeight: '700', color: colors.warning },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: 13, marginTop: 12,
  },
  outlineBtnText: { color: colors.primary, fontWeight: '600', fontSize: 15 },

  // Primary CTA
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: 16, marginBottom: 8,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30, shadowRadius: 8, elevation: 5,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '600', color: '#fff', letterSpacing: -0.3 },
});
