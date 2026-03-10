import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/styles/theme';
import { getToken } from '@/utils/storage.utils';

export default function Index() {
  const router = useRouter();
  // Check stored API token to decide where to navigate
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!cancelled) setAuthState(token ? 'authenticated' : 'unauthenticated');
      } catch {
        if (!cancelled) setAuthState('unauthenticated');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // While Firebase resolves persisted auth (<200ms), show subtle loading
  if (authState === 'checking' || authState === 'authenticated') {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.title}>ShiftWork Mobile</Text>
        <Text style={styles.subtitle}>Workforce Management</Text>
      </View>

      <View style={styles.content}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => router.push('(auth)/login' as Href<string>)}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </Pressable>

        <Text style={styles.infoText}>
          Clock in/out • View Schedules • Track Hours
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Version 1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#fff',
    opacity: 0.9,
  },
  content: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  button: {
    backgroundColor: colors.surface,
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
  },
  infoText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.6,
  },
});
