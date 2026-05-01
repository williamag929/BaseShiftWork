import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/store/sessionStore';
import { useDeviceStore } from '@/store/deviceStore';
import { interstitialService, KioskBulletin, KioskSafety } from '@/services/interstitial.service';
import { colors, spacing, radius, typography, shadow } from '@/styles/tokens';

type InterstitialItem =
  | { kind: 'bulletin'; data: KioskBulletin }
  | { kind: 'safety';   data: KioskSafety };

// Auto-advance after 30 s if employee walks away
const AUTO_ADVANCE_MS = 30_000;

export default function InterstitialScreen() {
  const router = useRouter();
  const { personId: personIdParam } = useLocalSearchParams<{ personId: string }>();
  const personId = parseInt(personIdParam ?? '0', 10);

  const resetSession = useSessionStore((s) => s.reset);
  const { companyId, locationId } = useDeviceStore();

  const [items, setItems]     = useState<InterstitialItem[]>([]);
  const [index, setIndex]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [acting, setActing]   = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const autoRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goHome = useCallback(() => {
    if (autoRef.current) clearTimeout(autoRef.current);
    resetSession();
    router.replace('/(kiosk)');
  }, [resetSession, router]);

  const scheduleAuto = useCallback(() => {
    if (autoRef.current) clearTimeout(autoRef.current);
    autoRef.current = setTimeout(goHome, AUTO_ADVANCE_MS);
  }, [goHome]);

  useEffect(() => {
    (async () => {
      try {
        const payload = await interstitialService.getPostClockout(companyId, personId, locationId || undefined);
        const built: InterstitialItem[] = [
          ...payload.urgentBulletins.map(b => ({ kind: 'bulletin' as const, data: b })),
          ...payload.pendingSafety.map(s => ({ kind: 'safety' as const, data: s })),
        ];
        setItems(built);
        if (built.length === 0) {
          goHome();
        } else {
          scheduleAuto();
        }
      } catch {
        setLoadError(true);
        autoRef.current = setTimeout(goHome, 5_000);
      } finally {
        setLoading(false);
      }
    })();

    return () => { if (autoRef.current) clearTimeout(autoRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fadeTransition = (next: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      next();
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  const advance = useCallback(() => {
    const nextIndex = index + 1;
    if (nextIndex >= items.length) {
      goHome();
    } else {
      fadeTransition(() => setIndex(nextIndex));
      scheduleAuto();
    }
  }, [index, items.length, goHome, scheduleAuto]);

  const handleBulletinAck = async (b: KioskBulletin) => {
    setActing(true);
    try {
      await interstitialService.markBulletinRead(companyId, b.bulletinId, personId);
    } catch { /* non-critical — proceed anyway */ }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActing(false);
    advance();
  };

  const handleSafetyAck = async (s: KioskSafety) => {
    setActing(true);
    try {
      await interstitialService.acknowledgeSafety(companyId, s.safetyContentId, personId);
    } catch { /* non-critical — proceed anyway */ }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActing(false);
    advance();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="checkmark-circle-outline" size={72} color={colors.primary} />
          <Text style={styles.fallbackTitle}>No messages</Text>
          <Text style={styles.fallbackBody}>You're all set. Have a great shift!</Text>
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 32 }]} onPress={goHome}>
            <Text style={styles.primaryBtnText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const current = items[index];
  if (!current) return null;

  const isLast = index === items.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {items.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        {current.kind === 'bulletin' ? (
          <BulletinSlide
            item={current.data}
            acting={acting}
            isLast={isLast}
            onAck={() => handleBulletinAck(current.data)}
            onSkip={() => advance()}
          />
        ) : (
          <SafetySlide
            item={current.data}
            acting={acting}
            isLast={isLast}
            onAck={() => handleSafetyAck(current.data)}
            onSkip={() => advance()}
          />
        )}
      </Animated.View>

      {/* Skip to home */}
      <Pressable style={styles.skipBtn} onPress={goHome}>
        <Text style={styles.skipText}>Skip all · Done</Text>
      </Pressable>
    </SafeAreaView>
  );
}

/* ─── Bulletin slide ─── */
function BulletinSlide({
  item, acting, isLast, onAck, onSkip,
}: {
  item: KioskBulletin;
  acting: boolean;
  isLast: boolean;
  onAck: () => void;
  onSkip: () => void;
}) {
  const PRIORITY_COLOR: Record<string, string> = {
    Critical: '#FF3B30',
    High:     '#FF9500',
    Normal:   colors.primary,
  };
  const accent = PRIORITY_COLOR[item.priority] ?? colors.primary;

  return (
    <View style={styles.slide}>
      <View style={[styles.typeBadge, { backgroundColor: accent }]}>
        <Ionicons name="megaphone-outline" size={20} color="#fff" />
        <Text style={styles.typeBadgeText}>{item.priority} BULLETIN</Text>
      </View>

      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideBody}>{item.content}</Text>

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, { backgroundColor: accent }, pressed && { opacity: 0.85 }, acting && styles.btnDisabled]}
        onPress={onAck}
        disabled={acting}
      >
        {acting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.primaryBtnText}>{isLast ? 'Got it · Done' : 'Got it · Next'}</Text>
        }
      </Pressable>
    </View>
  );
}

/* ─── Safety slide ─── */
function SafetySlide({
  item, acting, isLast, onAck, onSkip,
}: {
  item: KioskSafety;
  acting: boolean;
  isLast: boolean;
  onAck: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={styles.slide}>
      <View style={[styles.typeBadge, { backgroundColor: '#FF9500' }]}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
        <Text style={styles.typeBadgeText}>SAFETY · {item.type.toUpperCase()}</Text>
      </View>

      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideBody}>{item.description}</Text>

      {!!item.textContent && (
        <View style={styles.textContentBox}>
          <Text style={styles.textContentText}>{item.textContent}</Text>
        </View>
      )}

      {item.isAcknowledgmentRequired ? (
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, { backgroundColor: '#34C759' }, pressed && { opacity: 0.85 }, acting && styles.btnDisabled]}
          onPress={onAck}
          disabled={acting}
        >
          {acting
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="checkmark-done-outline" size={22} color="#fff" />
                <Text style={styles.primaryBtnText}>{isLast ? 'I Acknowledge · Done' : 'I Acknowledge · Next'}</Text>
              </>
          }
        </Pressable>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
          onPress={onAck}
        >
          <Text style={styles.primaryBtnText}>{isLast ? 'Noted · Done' : 'Noted · Next'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.background },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dotsRow:         { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: spacing.lg, paddingBottom: spacing.md },
  dot:             { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceBorder },
  dotActive:       { backgroundColor: colors.primary, width: 24 },
  card:            { flex: 1, marginHorizontal: spacing.xxl, justifyContent: 'center' },
  slide:           { gap: spacing.xl, alignItems: 'center' },
  typeBadge:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full ?? 999, alignSelf: 'center' },
  typeBadgeText:   { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  slideTitle:      { fontSize: 32, fontWeight: '700', color: colors.text, textAlign: 'center', letterSpacing: -0.5, lineHeight: 38 },
  slideBody:       { fontSize: 18, color: colors.textSecondary, textAlign: 'center', lineHeight: 26 },
  textContentBox:  { backgroundColor: colors.surface, borderRadius: radius.lg ?? 12, padding: spacing.lg, width: '100%' },
  textContentText: { fontSize: 15, color: colors.text, lineHeight: 23 },
  primaryBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 20, paddingHorizontal: 48, borderRadius: radius.xl ?? 16, minWidth: 280, ...shadow.raised },
  btnDisabled:     { opacity: 0.6 },
  primaryBtnText:  { color: '#fff', fontSize: 20, fontWeight: '700' },
  skipBtn:         { alignSelf: 'center', paddingVertical: spacing.lg, paddingBottom: spacing.xxl },
  skipText:        { fontSize: 16, color: colors.textMuted, letterSpacing: 0.2 },
  fallbackTitle:   { fontSize: 28, fontWeight: '700', color: colors.text, marginTop: 20, textAlign: 'center' },
  fallbackBody:    { fontSize: 17, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
});
