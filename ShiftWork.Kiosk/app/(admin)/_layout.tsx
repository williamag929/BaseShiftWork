import { Stack } from 'expo-router';
import { colors } from '@/styles/tokens';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_bottom',
      }}
    />
  );
}
