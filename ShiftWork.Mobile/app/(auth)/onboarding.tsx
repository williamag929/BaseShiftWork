import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registrationService, SandboxStatusResponse } from '@/services/registration.service';
import { colors } from '@/styles/theme';

export default function OnboardingScreen() {
  const router = useRouter();
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [companyId, setCompanyId] = useState<string>('');

  // Load companyId from AsyncStorage (persists across app restarts)
  useEffect(() => {
    AsyncStorage.getItem('onboarding_company_id').then(id => {
      if (id) {
        setCompanyId(id);
      } else {
        setLoading(false);
      }
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
      setMessage('Could not load sandbox status.');
    } finally {
      setLoading(false);
    }
  };

  const handleHide = async () => {
    setActionLoading(true);
    try {
      await registrationService.hideSandboxData(companyId);
      setMessage('Demo data hidden. You can restore it from Settings.');
      await loadStatus();
    } catch {
      setMessage('Failed to hide demo data.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    setActionLoading(true);
    try {
      await registrationService.resetSandboxData(companyId);
      setMessage('Demo data reset to defaults.');
      await loadStatus();
    } catch {
      setMessage('Failed to reset demo data.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Remove Demo Data',
      'This will permanently remove all demo data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await registrationService.deleteSandboxData(companyId);
              setMessage('Demo data removed. Workspace is clean.');
              setSandboxStatus({ hasSandboxData: false, sandboxPersonCount: 0, sandboxAreaCount: 0, sandboxLocationCount: 0 });
            } catch {
              setMessage('Failed to delete demo data.');
            } finally {
              setActionLoading(false);
            }
          }
        },
      ]
    );
  };

  const goToDashboard = () => {
    // Clear onboarding data from persistent storage
    AsyncStorage.multiRemove(['onboarding_company_id', 'onboarding_plan']);
    router.replace('/(tabs)/dashboard');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Welcome to ShiftWork! 🎉</Text>
      <Text style={styles.subtitle}>Your account is set up. Let's get you started.</Text>

      {!!message && <Text style={styles.message}>{message}</Text>}

      {sandboxStatus?.hasSandboxData && (
        <View style={styles.sandboxCard}>
          <Text style={styles.sandboxBadge}>Demo Data</Text>
          <Text style={styles.sandboxTitle}>Your account includes sample data</Text>
          <Text style={styles.sandboxDesc}>
            We've added demo employees, a location, and an area so you can explore ShiftWork right away.
            This data is clearly marked as sandbox and won't affect your real records.
          </Text>
          <View style={styles.countRow}>
            <View style={styles.countItem}>
              <Text style={styles.countNum}>{sandboxStatus.sandboxPersonCount}</Text>
              <Text style={styles.countLabel}>Employees</Text>
            </View>
            <View style={styles.countItem}>
              <Text style={styles.countNum}>{sandboxStatus.sandboxLocationCount}</Text>
              <Text style={styles.countLabel}>Locations</Text>
            </View>
            <View style={styles.countItem}>
              <Text style={styles.countNum}>{sandboxStatus.sandboxAreaCount}</Text>
              <Text style={styles.countLabel}>Areas</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.btnOutline} onPress={handleHide} disabled={actionLoading}>
            <Text style={styles.btnOutlineText}>Hide demo data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnOutline, styles.btnOutlineWarning]} onPress={handleReset} disabled={actionLoading}>
            <Text style={styles.btnOutlineText}>Reset to defaults</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnOutline, styles.btnOutlineDanger]} onPress={handleDelete} disabled={actionLoading}>
            <Text style={styles.btnOutlineText}>Remove demo data permanently</Text>
          </TouchableOpacity>
        </View>
      )}

      {sandboxStatus && !sandboxStatus.hasSandboxData && (
        <View style={styles.cleanCard}>
          <Text style={styles.cleanText}>✅ Your workspace is clean and ready for real data.</Text>
        </View>
      )}

      <View style={styles.planCard}>
        <Text style={styles.planTitle}>You're on the Free plan</Text>
        <Text style={styles.planDesc}>Upgrade to Pro for advanced scheduling, analytics, multi-location, and more.</Text>
        <TouchableOpacity style={styles.btnUpgrade} onPress={() => router.push('/(tabs)/upgrade')}>
          <Text style={styles.btnUpgradeText}>Explore Pro →</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.btnDashboard} onPress={goToDashboard}>
        <Text style={styles.btnDashboardText}>Go to Dashboard →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24, paddingBottom: 48 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.primary, marginBottom: 4 },
  subtitle: { color: colors.muted, marginBottom: 20, fontSize: 15 },
  message: { backgroundColor: '#d4edda', color: '#155724', padding: 12, borderRadius: 8, marginBottom: 16 },
  sandboxCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#17a2b8' },
  sandboxBadge: { color: '#17a2b8', fontWeight: '700', fontSize: 12, marginBottom: 4 },
  sandboxTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  sandboxDesc: { color: colors.muted, lineHeight: 20, marginBottom: 12 },
  countRow: { flexDirection: 'row', marginBottom: 16 },
  countItem: { flex: 1, alignItems: 'center' },
  countNum: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
  countLabel: { color: colors.muted, fontSize: 12 },
  btnOutline: { borderWidth: 1, borderColor: '#6c757d', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 8 },
  btnOutlineWarning: { borderColor: '#ffc107' },
  btnOutlineDanger: { borderColor: '#dc3545' },
  btnOutlineText: { color: '#333', fontWeight: '500' },
  cleanCard: { backgroundColor: '#d4edda', borderRadius: 8, padding: 16, marginBottom: 16 },
  cleanText: { color: '#155724', fontWeight: '500' },
  planCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  planTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  planDesc: { color: colors.muted, lineHeight: 20, marginBottom: 12 },
  btnUpgrade: { borderWidth: 1, borderColor: colors.primary, borderRadius: 8, padding: 12, alignItems: 'center' },
  btnUpgradeText: { color: colors.primary, fontWeight: '600' },
  btnDashboard: { backgroundColor: '#28a745', borderRadius: 8, padding: 16, alignItems: 'center' },
  btnDashboardText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
