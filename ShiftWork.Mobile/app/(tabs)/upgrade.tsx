import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/styles/theme';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from '@/i18n';

// Mirrors ShiftWork.Api/Helpers/PlanCatalog.cs (active-employee caps). null = unlimited.
const TIERS: { key: string; cap: number | null }[] = [
  { key: 'upgrade.plan_free', cap: 5 },
  { key: 'upgrade.plan_starter', cap: 25 },
  { key: 'upgrade.plan_pro', cap: 100 },
  { key: 'upgrade.plan_business', cap: null },
];

// Billing lives on the web Plan & Billing page (Stripe Checkout + Customer Portal).
// The app only links there, so no card data ever passes through the mobile app.
function billingUrl(appUrl: string | undefined): string | null {
  const base = appUrl?.trim().replace(/\/+$/, '');
  return base ? `${base}/dashboard/billing` : null;
}

export default function UpgradeScreen() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useTranslation();

  const handleManageBilling = async () => {
    const url = billingUrl(process.env.EXPO_PUBLIC_APP_URL);
    if (!url) {
      toast.error(t('upgrade.no_web_url'));
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      toast.error(t('upgrade.open_failed'));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <Text style={styles.title}>{t('upgrade.plans_title')}</Text>
      <Text style={styles.subtitle}>{t('upgrade.plans_subtitle')}</Text>

      <View style={styles.tableCard}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, styles.tableCellFeature, styles.headerText]}>{t('upgrade.col_plan')}</Text>
          <Text style={[styles.tableCell, styles.tableCellPlan, styles.headerText]}>{t('upgrade.col_employees')}</Text>
        </View>
        {TIERS.map((tier) => (
          <View key={tier.key} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellFeature]}>{t(tier.key)}</Text>
            <Text style={[styles.tableCell, styles.tableCellPlan]}>
              {tier.cap === null ? t('upgrade.unlimited') : String(tier.cap)}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.note}>{t('upgrade.trial_note')}</Text>
      <Text style={styles.note}>{t('upgrade.billing_web_note')}</Text>

      <TouchableOpacity style={styles.btnUpgrade} onPress={handleManageBilling} accessibilityRole="link">
        <Text style={styles.btnUpgradeText}>{t('upgrade.manage_billing_btn')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>{t('upgrade.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.primary, marginBottom: 4 },
  subtitle: { color: colors.muted, marginBottom: 20 },
  tableCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingVertical: 12 },
  tableHeader: { backgroundColor: '#f8f9fa' },
  headerText: { fontWeight: '700' },
  tableCell: { paddingHorizontal: 12, fontSize: 14 },
  tableCellFeature: { flex: 2, color: '#333' },
  tableCellPlan: { flex: 1, textAlign: 'center' },
  note: { color: colors.muted, fontSize: 13, marginBottom: 12 },
  btnUpgrade: { backgroundColor: colors.primary, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 12 },
  btnUpgradeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backBtn: { alignItems: 'center', padding: 12 },
  backBtnText: { color: colors.muted },
});
