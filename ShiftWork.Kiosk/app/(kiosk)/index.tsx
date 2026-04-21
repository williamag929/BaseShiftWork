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
import { Ionicons } from '@expo/vector-icons';

import * as Haptics from 'expo-haptics';
import { kioskService } from '@/services/kiosk.service';
import { useDeviceStore } from '@/store/deviceStore';
import { useSessionStore } from '@/store/sessionStore';
import { colors, spacing, radius, typography, shadow } from '@/styles/tokens';
import type { KioskEmployee } from '@/types';

const AVATAR_SIZE = 72;
const CARD_WIDTH = 180;

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
        <View style={[
          styles.avatarRing,
          employee.statusShiftWork === 'OnShift' && styles.avatarRingActive,
        ]}>
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
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {employee.name}
        </Text>
        {employee.statusShiftWork === 'OnShift' && (
          <View style={styles.onShiftBadge}>
            <Text style={styles.onShiftText}>On Shift</Text>
          </View>
        )}
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
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employee…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>
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
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.glassBorder,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: {
    flex: 1,
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
    borderWidth: 0.5,
    borderColor: colors.glassBorder,
    borderRadius: radius.xl,
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  cardPressed: { backgroundColor: colors.surfaceElevated },
  avatarRing: {
    padding: 3,
    borderRadius: radius.full,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  avatarRingActive: {
    borderColor: colors.clockIn,
  },
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
  avatarInitial: { fontSize: 26, fontWeight: '600' as const, color: colors.textOnPrimary },
  name: { ...typography.label, color: colors.text, textAlign: 'center' },
  onShiftBadge: {
    backgroundColor: colors.clockIn + '22',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.clockIn + '55',
  },
  onShiftText: { fontSize: 10, fontWeight: '600' as const, color: colors.clockIn, letterSpacing: 0.5 },
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
