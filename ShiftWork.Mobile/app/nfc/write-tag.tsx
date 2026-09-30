import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import { colors, radius, spacing } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useNfcTagLinks, nfcTagLinksKey } from '@/hooks/queries';
import { useNfcAvailability } from '@/hooks/useNfcAvailability';
import { nfcService } from '@/services/nfc.service';
import { nfcPunchService } from '@/services/nfc-punch.service';

/** Managers write a site's tag link onto a blank NFC tag. */
export default function WriteTagScreen() {
  const { t } = useTranslation();
  const { companyId } = useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const availability = useNfcAvailability();
  const { data: links, isLoading, error } = useNfcTagLinks(companyId);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lock, setLock] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = links?.find((l) => l.locationId === selectedId) ?? null;
  const forbidden = (error as { statusCode?: number } | null)?.statusCode === 403;

  const createLink = async () => {
    if (!companyId || !selected) return;
    setBusy(true);
    try {
      await nfcPunchService.createTagLink(companyId, selected.locationId);
      await queryClient.invalidateQueries({ queryKey: nfcTagLinksKey(companyId) });
    } catch (e: any) {
      toast.error(e?.message ?? t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const writeTag = async () => {
    if (!selected?.tagUrl) return;
    setBusy(true);
    try {
      await nfcService.writeTagUrl(selected.tagUrl, t('nfc.write_prompt'), lock);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('nfc.write_success', { site: selected.name }));
    } catch {
      toast.error(t('nfc.write_failed'));
    } finally {
      setBusy(false);
    }
  };

  let body: ReactNode;
  if (forbidden) {
    body = <Text style={styles.message}>{t('nfc.write_managers_only')}</Text>;
  } else if (availability === 'unsupported') {
    body = <Text style={styles.message}>{t('nfc.unsupported')}</Text>;
  } else if (isLoading || availability === null) {
    body = <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />;
  } else {
    body = (
      <>
        {availability === 'disabled' && <Text style={styles.message}>{t('nfc.disabled')}</Text>}
        <Text style={styles.sectionTitle}>{t('nfc.write_pick_site')}</Text>
        {(links ?? []).map((link) => (
          <Pressable
            key={link.locationId}
            onPress={() => setSelectedId(link.locationId)}
            style={[styles.row, link.locationId === selectedId && styles.rowSelected]}
            accessibilityRole="radio"
            accessibilityState={{ selected: link.locationId === selectedId }}
          >
            <Text style={styles.rowTitle}>{link.name}</Text>
            {!link.tagUrl && <Text style={styles.rowHint}>{t('nfc.write_no_link')}</Text>}
            {link.locationId === selectedId && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
          </Pressable>
        ))}

        {selected && !selected.tagUrl && (
          <Button label={t('nfc.write_create_link')} onPress={createLink} loading={busy} fullWidth style={styles.action} />
        )}

        {selected?.tagUrl && (
          <>
            <View style={styles.lockRow}>
              <Text style={styles.lockText}>{t('nfc.write_lock')}</Text>
              <Switch value={lock} onValueChange={setLock} accessibilityRole="switch" />
            </View>
            <Button
              label={t('nfc.write_button')}
              onPress={writeTag}
              loading={busy}
              disabled={availability !== 'ready'}
              size="lg"
              fullWidth
              style={styles.action}
            />
          </>
        )}
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('nfc.write_title') }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>{body}</ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginVertical: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.lg,
    borderRadius: radius.lg, backgroundColor: colors.surface, marginBottom: spacing.sm,
  },
  rowSelected: { borderWidth: 2, borderColor: colors.primary },
  rowTitle: { flex: 1, fontSize: 16, color: colors.text },
  rowHint: { fontSize: 13, color: colors.muted },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  lockText: { flex: 1, fontSize: 15, color: colors.text },
  action: { marginTop: spacing.lg },
  message: { fontSize: 16, color: colors.textSecondary, marginVertical: spacing.lg, textAlign: 'center' },
});
