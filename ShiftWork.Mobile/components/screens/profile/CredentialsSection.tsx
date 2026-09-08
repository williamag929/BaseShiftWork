import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { SectionHeader } from '@/components/ui';
import { colors, spacing, radius } from '@/styles/tokens';
import { credentialService } from '@/services/credential.service';
import type { CredentialDto, CredentialExpiryStatus } from '@/types/api';

interface Props {
  companyId?: string;
  personId?: number;
}

const STATUS_META: Record<CredentialExpiryStatus, { label: string; color: string; bg: string }> = {
  Valid: { label: 'Valid', color: colors.success, bg: colors.successLight },
  ExpiringSoon: { label: 'Expiring Soon', color: '#b45309', bg: 'rgba(180,83,9,0.10)' },
  Expired: { label: 'Expired', color: colors.danger, bg: colors.dangerLight },
};

/** Read-only — only managers add/edit credentials (via the Angular admin console). */
export function CredentialsSection({ companyId, personId }: Props) {
  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ['my-credentials', companyId, personId],
    queryFn: () => credentialService.getMyCredentials(companyId!, personId!),
    enabled: !!companyId && !!personId,
    staleTime: 60_000,
  });

  if (!companyId || !personId || (!isLoading && credentials.length === 0)) {
    return null;
  }

  return (
    <View style={styles.section}>
      <SectionHeader title="My Credentials" />
      <View style={styles.card}>
        {isLoading && <Text style={styles.emptyText}>Loading…</Text>}
        {!isLoading && credentials.map((c: CredentialDto, index: number) => {
          const meta = STATUS_META[c.expiryStatus];
          return (
            <View key={c.credentialId} style={[styles.row, index === credentials.length - 1 && styles.rowLast]}>
              <View style={styles.rowText}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.expiry}>
                  Expires {new Date(c.expiryDate).toLocaleDateString()}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                {c.expiryStatus !== 'Valid' && (
                  <Ionicons name="alert-circle" size={12} color={meta.color} style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 4 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  rowText: { flex: 1, marginRight: 12 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  expiry: { fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  emptyText: { fontSize: 13, color: colors.muted },
});
