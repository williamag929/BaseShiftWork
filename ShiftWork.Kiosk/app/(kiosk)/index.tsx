import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';

import * as Haptics from 'expo-haptics';
import { kioskService } from '@/services/kiosk.service';
import { useDeviceStore } from '@/store/deviceStore';
import { useSessionStore } from '@/store/sessionStore';
import { colors, spacing, radius, typography, shadow } from '@/styles/tokens';
import type { KioskEmployee } from '@/types';

const AVATAR_SIZE = 72;
const CARD_WIDTH = 180;

function statusColor(status?: string) {
  if (status === 'OnShift') return colors.clockIn;
  return colors.textMuted;
}

function EmployeeCard({
  employee,
  index,
  onPress,
}: {
  employee: KioskEmployee;
  index: number;
  onPress: () => void;
}) {
  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={onPress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Clock in or out for ${employee.name}`}
      >
        {employee.photoUrl ? (
          <Image
            source={{ uri: employee.photoUrl }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {employee.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.name} numberOfLines={2}>
          {employee.name}
        </Text>
        <View style={[styles.dot, { backgroundColor: statusColor(employee.statusShiftWork) }]} />
      </Pressable>
    </View>
  );
}

export default function EmployeeListScreen() {
  const router = useRouter();
  const companyId = useDeviceStore((s) => s.companyId);
  const setEmployee = useSessionStore((s) => s.setEmployee);
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['kiosk-employees', companyId],
    queryFn: () => kioskService.getEmployees(companyId),
    refetchInterval: 45_000, // auto-refresh every 45 s
    staleTime: 30_000,
  });

  const filtered = (data ?? []).filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectEmployee = useCallback(
    async (employee: KioskEmployee) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setEmployee(employee);
      router.push('/(kiosk)/pin');
    },
    [router, setEmployee]
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not load employees.</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search employee…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
        <Text style={styles.tap}>Tap your name to clock in or out</Text>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No employees found.</Text>
        </View>
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => String(item.personId)}
          numColumns={Math.floor(360 / CARD_WIDTH) || 4}
          estimatedItemSize={210}
          renderItem={({ item, index }) => (
            <EmployeeCard
              employee={item}
              index={index}
              onPress={() => handleSelectEmployee(item)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...typography.body,
  },
  tap: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
  list: { padding: spacing.md },
  card: {
    width: CARD_WIDTH,
    margin: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  cardPressed: { backgroundColor: colors.surfaceElevated },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.full,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { ...typography.h2, color: colors.textOnPrimary },
  name: { ...typography.label, color: colors.text, textAlign: 'center' },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  errorText: { ...typography.body, color: colors.danger },
  emptyText: { ...typography.body, color: colors.textMuted },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  retryText: { ...typography.label, color: colors.textOnPrimary },
});
