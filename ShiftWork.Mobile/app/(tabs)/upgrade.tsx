import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { registrationService } from '@/services/registration.service';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/styles/theme';
import { useToast } from '@/hooks/useToast';

const FEATURES = [
  { label: 'Kiosk Clock-In / Out', free: true, pro: true },
  { label: 'Basic Scheduling', free: true, pro: true },
  { label: 'Sandbox Demo Data', free: true, pro: true },
  { label: 'Remove Sandbox Data', free: false, pro: true },
  { label: 'Advanced Scheduling', free: false, pro: true },
  { label: 'Analytics & Reports', free: false, pro: true },
  { label: 'Multi-Location Support', free: false, pro: true },
  { label: 'Data Export', free: false, pro: true },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const companyId = useAuthStore((s) => s.companyId);
  const toast = useToast();

  const handleUpgrade = () => {
    if (!companyId) {
      toast.error('No active company. Please sign in again.');
      return;
    }
    // For mobile MVP: deep-link to web upgrade page to stay out of PCI scope.
    // When a web URL is configured, open it. Otherwise simulate locally.
    const webUpgradeUrl = process.env.EXPO_PUBLIC_APP_URL
      ? `${process.env.EXPO_PUBLIC_APP_URL}/upgrade`
      : null;

    if (webUpgradeUrl) {
      Linking.openURL(webUpgradeUrl);
    } else {
      // Fallback: call API directly (stub payment method for dev)
      // TODO Phase 3: replace with bottom-sheet confirm
      Alert.alert(
        'Upgrade to Pro',
        'This will upgrade your plan to Pro. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade',
            onPress: async () => {
              setLoading(true);
              try {
                const response = await registrationService.upgradePlan(companyId, {
                  stripePaymentMethodId: 'pm_stub_mobile',
                  targetPlan: 'Pro',
                });
                if (response.success) {
                  toast.success(`You are now on the ${response.plan} plan.`);
                  router.back();
                } else {
                  toast.error(response.message);
                }
              } catch {
                toast.error('Upgrade failed. Please try from the web app.');
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Upgrade to Pro</Text>
      <Text style={styles.subtitle}>Unlock the full power of ShiftWork for your team.</Text>

      {/* Feature comparison */}
      <View style={styles.tableCard}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, styles.tableCellFeature]}>Feature</Text>
          <Text style={[styles.tableCell, styles.tableCellPlan]}>Free</Text>
          <Text style={[styles.tableCell, styles.tableCellPlan, styles.proPlanHeader]}>Pro ⭐</Text>
        </View>
        {FEATURES.map((f) => (
          <View key={f.label} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellFeature]}>{f.label}</Text>
            <Text style={[styles.tableCell, styles.tableCellPlan]}>{f.free ? '✅' : '❌'}</Text>
            <Text style={[styles.tableCell, styles.tableCellPlan]}>{f.pro ? '✅' : '❌'}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.btnUpgrade} onPress={handleUpgrade} disabled={loading}>
        <Text style={styles.btnUpgradeText}>{loading ? 'Processing…' : 'Upgrade to Pro Now'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.primary, marginBottom: 4 },
  subtitle: { color: colors.muted, marginBottom: 20 },
  tableCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 24 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingVertical: 12 },
  tableHeader: { backgroundColor: '#f8f9fa' },
  tableCell: { paddingHorizontal: 12, fontSize: 14 },
  tableCellFeature: { flex: 2, color: '#333' },
  tableCellPlan: { flex: 1, textAlign: 'center' },
  proPlanHeader: { color: colors.primary, fontWeight: '700' },
  btnUpgrade: { backgroundColor: colors.primary, borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnUpgradeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backBtn: { alignItems: 'center', padding: 12 },
  backBtnText: { color: colors.muted },
});
