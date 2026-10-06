import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/styles/tokens';
import { useTranslation } from '@/i18n';
import { useServerLocale } from '@/hooks/useServerLocale';
import { usePendingTagStore } from '@/store/pendingTagStore';
import { useAuthStore } from '@/store/authStore';

/** Apple-style active tab icon — filled variant with tinted dot indicator */
function TabIcon({
  name,
  filled,
  color,
  size,
}: {
  name: keyof typeof Ionicons.glyphMap;
  filled: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
}) {
  const isActive = color === colors.primary;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size + 8, height: size + 8 }}>
      <Ionicons name={isActive ? filled : name} size={size} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  useServerLocale();
  const router = useRouter();
  const personId = useAuthStore((s) => s.personId);
  const companyId = useAuthStore((s) => s.companyId);
  // Finish a tag tap that had to wait for sign-in; keyed on the identity so a re-login while mounted resumes it too.
  useEffect(() => {
    if (!personId || !companyId) return;
    const pending = usePendingTagStore.getState().take();
    if (pending) router.push(`/t/${pending}` as any);
  }, [router, personId, companyId]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: Platform.OS === 'ios' ? 'rgba(242,242,247,0.92)' : colors.surface,
          borderTopWidth: 0.5,
          borderTopColor: colors.borderOpaque,
          // iOS-style blur tab bar height
          height: Platform.OS === 'ios' ? 83 : 60,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.2,
          marginTop: -2,
        },
        // iOS large-title navigation header
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.borderOpaque,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontSize: 17,
          fontWeight: '600' as const,
          color: colors.text,
          letterSpacing: -0.4,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('tabs.home'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home-outline" filled="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="clock"
        options={{
          title: t('tabs.clock'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="time-outline" filled="time" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule-grid"
        options={{ title: 'Grid', href: null }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t('tabs.schedule'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="calendar-outline" filled="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-outline" filled="person" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-chat"
        options={{
          title: t('tabs.ai'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="chatbubble-ellipses-outline" filled="chatbubble-ellipses" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: t('tabs.docs'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="folder-outline" filled="folder" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="bulletins"
        options={{
          title: t('tabs.bulletins'),
          href: null,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="megaphone-outline" filled="megaphone" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="safety"
        options={{
          title: t('tabs.safety'),
          href: null,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="shield-checkmark-outline" filled="shield-checkmark" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="daily-report"
        options={{
          title: t('tabs.report'),
          href: null,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="clipboard-outline" filled="clipboard" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen name="time-off-request" options={{ title: 'Request Time Off', href: null }} />
      <Tabs.Screen name="weekly-schedule"  options={{ title: 'Weekly Schedule',    href: null }} />
      <Tabs.Screen
        name="upgrade"
        options={{
          title: t('tabs.upgrade'),
          href: null,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
        }}
      />
    </Tabs>
  );
}
