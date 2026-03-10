import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '@/store/authStore';
import { saveCompanyId } from '@/utils/storage.utils';
import { companyService, CompanySummary } from '@/services/company.service';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/utils/logger';
import { colors, spacing, radius } from '@/styles/tokens';

export default function CompanySelectScreen() {
  const router = useRouter();
  const toast = useToast();
  const setCompanyId = useAuthStore((s) => s.setCompanyId);

  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const list = await companyService.getMyCompanies();
      setCompanies(list);

      // Single company — auto-select and skip the picker
      if (list.length === 1) {
        await selectCompany(list[0], true);
      }
    } catch (err) {
      logger.error('[CompanySelect] failed to load companies:', err);
      toast.error('Could not load your companies. Please log in again.');
    } finally {
      setLoading(false);
    }
  };

  const selectCompany = async (company: CompanySummary, auto = false) => {
    setSelecting(company.companyId);
    try {
      setCompanyId(company.companyId);
      await saveCompanyId(company.companyId);
      if (!auto) {
        await Haptics.selectionAsync();
      }
      router.replace('/(tabs)/dashboard' as any);
    } catch (err) {
      logger.error('[CompanySelect] failed to select company:', err);
      toast.error('Could not switch company.');
      setSelecting(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your companies…</Text>
      </View>
    );
  }

  if (companies.length === 0) {
    return (
      <View style={styles.centered}>
        <StatusBar style="light" />
        <Text style={styles.emptyTitle}>No companies found</Text>
        <Text style={styles.emptySubtitle}>
          Your account is not linked to any company yet.{'\n'}
          Contact your administrator.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back!</Text>
        <Text style={styles.subtitle}>Select a company to continue</Text>
      </View>

      <FlatList
        data={companies}
        keyExtractor={(item) => item.companyId}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
                selecting === item.companyId && styles.cardSelecting,
              ]}
              onPress={() => selectCompany(item)}
              disabled={selecting !== null}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.name || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.companyName}>{item.name}</Text>
                {item.email && (
                  <Text style={styles.companyEmail}>{item.email}</Text>
                )}
              </View>
              {selecting === item.companyId ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </Pressable>
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.muted,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 64,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  cardSelecting: {
    opacity: 0.6,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  cardBody: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  companyEmail: {
    fontSize: 13,
    color: colors.muted,
  },
  chevron: {
    fontSize: 24,
    color: colors.muted,
    marginLeft: spacing.sm,
  },
});
