import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/styles/tokens';
import { useAuthStore } from '@/store/authStore';
import { bulletinService } from '@/services/bulletin.service';
import { safetyService } from '@/services/safety.service';

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
  const { companyId } = useAuthStore();
  const [unreadBulletins, setUnreadBulletins] = useState(0);
  const [pendingSafety, setPendingSafety]     = useState(0);

  useEffect(() => {
    if (!companyId) return;
    bulletinService.getUnread(companyId)
      .then(data => setUnreadBulletins(data.length))
      .catch(() => {});
    safetyService.getPending(companyId)
      .then(data => setPendingSafety(data.length))
      .catch(() => {});
  }, [companyId]);

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
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home-outline" filled="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="calendar-outline" filled="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule-grid"
        options={{ title: 'Grid', href: null }}
      />
      <Tabs.Screen
        name="clock"
        options={{
          title: 'Clock',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="time-outline" filled="time" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-outline" filled="person" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-chat"
        options={{
          title: 'AI',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="chatbubble-ellipses-outline" filled="chatbubble-ellipses" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="bulletins"
        options={{
          title: 'Bulletins',
          headerShown: false,
          tabBarBadge: unreadBulletins > 0 ? unreadBulletins : undefined,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="megaphone-outline" filled="megaphone" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="safety"
        options={{
          title: 'Safety',
          headerShown: false,
          tabBarBadge: pendingSafety > 0 ? pendingSafety : undefined,
          tabBarBadgeStyle: { backgroundColor: '#FF3B30' },
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="shield-checkmark-outline" filled="shield-checkmark" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="daily-report"
        options={{
          title: 'Report',
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
          title: 'Upgrade to Pro',
          href: null,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
        }}
      />
    </Tabs>
  );
}
