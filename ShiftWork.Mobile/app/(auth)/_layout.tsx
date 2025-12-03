import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="login"
        options={{
          title: 'Login',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="pin-verify"
        options={{
          title: 'Verify PIN',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
