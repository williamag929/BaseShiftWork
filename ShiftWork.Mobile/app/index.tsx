import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function Index() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <View style={styles.header}>
        <Text style={styles.title}>ShiftWork Mobile</Text>
        <Text style={styles.subtitle}>Workforce Management</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('(auth)/login' as Href<string>)}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>

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
    backgroundColor: '#4A90E2',
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
    backgroundColor: '#fff',
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
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A90E2',
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
