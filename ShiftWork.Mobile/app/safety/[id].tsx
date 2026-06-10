import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
  NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { safetyService, SafetyContent } from '@/services/safety.service';
import { colors, spacing, radius } from '@/styles/tokens';

const TYPE_ICON: Record<string, React.ComponentPropsWithRef<typeof Ionicons>['name']> = {
  ToolboxTalk:        'construct-outline',
  SafetyDataSheet:    'warning-outline',
  Orientation:        'school-outline',
  InstructionalVideo: 'play-circle-outline',
  Training:           'ribbon-outline',
};

export default function SafetyDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companyId } = useAuthStore();

  const [item, setItem]                   = useState<SafetyContent | null>(null);
  const [loading, setLoading]             = useState(true);
  const [acking, setAcking]               = useState(false);
  const [acknowledged, setAcknowledged]   = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  useEffect(() => {
    safetyService.getById(companyId, id)
      .then(data => {
        setItem(data);
        setAcknowledged(data.isAcknowledgedByCurrentUser);
        // No text content means nothing to scroll — enable immediately
        if (!data.textContent) setScrolledToBottom(true);
      })
      .catch(() => Alert.alert('Error', 'Could not load safety content.'))
      .finally(() => setLoading(false));
  }, [companyId, id]);

  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    if (contentSize.height - layoutMeasurement.height - contentOffset.y < 60) {
      setScrolledToBottom(true);
    }
  };

  const acknowledge = async () => {
    if (!item || acking || acknowledged) return;
    setAcking(true);
    try {
      await safetyService.acknowledge(companyId, item.safetyContentId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAcknowledged(true);
    } catch {
      Alert.alert('Error', 'Could not record acknowledgment. Please try again.');
    } finally {
      setAcking(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!item) return null;

  const icon = TYPE_ICON[item.type] ?? 'shield-checkmark-outline';
  const ackEnabled = (item.isAcknowledgmentRequired ? scrolledToBottom : true) && !acknowledged && !acking;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Nav bar */}
      <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
          <Text style={styles.backText}>Safety</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator
      >
        {/* Type badge */}
        <View style={styles.typeBadgeRow}>
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={22} color={colors.primary} />
          </View>
          <Text style={styles.typeLabel}>{item.type.replace(/([A-Z])/g, ' $1').trim()}</Text>
        </View>

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>

        {!!item.durationMinutes && (
          <View style={styles.durationRow}>
            <Ionicons name="time-outline" size={15} color={colors.muted} />
            <Text style={styles.durationText}>{item.durationMinutes} min</Text>
          </View>
        )}

        {/* Inline text content */}
        {!!item.textContent && (
          <View style={styles.textContentBox}>
            <Text style={styles.textContent}>{item.textContent}</Text>
          </View>
        )}

        {/* External content (PDF / video) */}
        {!!item.contentUrl && (
          <TouchableOpacity
            style={styles.openContentBtn}
            onPress={() => {
              Linking.openURL(item.contentUrl!);
              setScrolledToBottom(true);
            }}
          >
            <Ionicons
              name={item.type === 'InstructionalVideo' ? 'play-circle-outline' : 'document-text-outline'}
              size={22}
              color={colors.primary}
            />
            <Text style={styles.openContentText}>
              {item.type === 'InstructionalVideo' ? 'Watch Video' : 'Open Document'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Scroll hint */}
        {item.isAcknowledgmentRequired && !scrolledToBottom && !!item.textContent && (
          <View style={styles.scrollHint}>
            <Ionicons name="arrow-down-outline" size={15} color={colors.muted} />
            <Text style={styles.scrollHintText}>Scroll to the bottom to enable acknowledgment</Text>
          </View>
        )}

        {/* Already acknowledged confirmation */}
        {acknowledged && (
          <View style={styles.ackedCard}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={styles.ackedText}>You have acknowledged this content.</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Fixed bottom acknowledge button */}
      {item.isAcknowledgmentRequired && !acknowledged && (
        <View style={styles.bottomBar}>
          {!scrolledToBottom && !!item.textContent && (
            <Text style={styles.scrollPrompt}>Read to the end to enable acknowledgment</Text>
          )}
          <TouchableOpacity
            style={[styles.ackBtn, !ackEnabled && styles.ackBtnDisabled]}
            onPress={acknowledge}
            disabled={!ackEnabled}
            activeOpacity={0.85}
          >
            {acking
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                  <Text style={styles.ackBtnText}>I Acknowledge</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.background },
  centered:        { alignItems: 'center', justifyContent: 'center' },
  navBar:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingBottom: 8, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  backBtn:         { flexDirection: 'row', alignItems: 'center', gap: 2, padding: spacing.sm },
  backText:        { fontSize: 17, color: colors.primary },
  scrollContent:   { padding: spacing.lg, gap: spacing.md },
  typeBadgeRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle:      { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  typeLabel:       { fontSize: 13, fontWeight: '600', color: colors.muted, letterSpacing: 0.3 },
  title:           { fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.4, lineHeight: 32 },
  description:     { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
  durationRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  durationText:    { fontSize: 13, color: colors.muted },
  textContentBox:  { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  textContent:     { fontSize: 15, color: colors.text, lineHeight: 23 },
  openContentBtn:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  openContentText: { fontSize: 16, fontWeight: '600', color: colors.primary },
  scrollHint:      { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: spacing.sm },
  scrollHintText:  { fontSize: 13, color: colors.muted },
  ackedCard:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.md },
  ackedText:       { fontSize: 14, color: colors.success, fontWeight: '500', flex: 1 },
  bottomBar:       { padding: spacing.md, paddingBottom: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 0.5, borderTopColor: colors.border, gap: 8 },
  ackBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 16 },
  ackBtnDisabled:  { backgroundColor: colors.muted, opacity: 0.5 },
  ackBtnText:      { color: '#fff', fontSize: 17, fontWeight: '700' },
  scrollPrompt:    { textAlign: 'center', fontSize: 12, color: colors.muted },
});
