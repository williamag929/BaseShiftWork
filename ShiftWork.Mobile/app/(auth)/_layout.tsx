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
      {/* New customer self-registration wizard (public - no auth required) */}
      <Stack.Screen
        name="register"
        options={{
          title: 'Create Account',
          headerShown: false,
        }}
      />
      {/* Onboarding sandbox management after registration */}
      <Stack.Screen
        name="onboarding"
        options={{
          title: 'Get Started',
          headerShown: true,
          headerBackVisible: false,
        }}
      />
    </Stack>
  );
}
