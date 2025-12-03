import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { authService, biometricAuthService } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { saveUserData, saveCompanyId } from '@/utils/storage.utils';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const setCompanyId = useAuthStore((s) => s.setCompanyId);
  const setPersonId = useAuthStore((s) => s.setPersonId);
  const setPersonProfile = useAuthStore((s) => s.setPersonProfile);

  useEffect(() => {
    checkBiometricAndAttemptLogin();
  }, []);

  const checkBiometricAndAttemptLogin = async () => {
    try {
      const shouldOffer = await biometricAuthService.shouldOfferBiometric();
      if (shouldOffer) {
        const types = await biometricAuthService.getSupportedTypes();
        const typeName = biometricAuthService.getAuthTypeName(types);
        setBiometricType(typeName);
        setShowBiometric(true);
        
        // Auto-attempt biometric login on mount
        setTimeout(() => handleBiometricLogin(), 500);
      }
    } catch (error) {
      console.error('Error checking biometric:', error);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const credentials = await biometricAuthService.biometricLogin();
      if (credentials) {
        // Successfully authenticated with biometrics
        setPersonId(credentials.personId);
        setCompanyId(credentials.companyId);
        setPersonProfile({
          email: credentials.email,
          firstName: credentials.firstName,
          lastName: credentials.lastName,
        });
        await saveUserData({
          personId: credentials.personId,
          email: credentials.email,
          firstName: credentials.firstName,
          lastName: credentials.lastName,
        });
        await saveCompanyId(credentials.companyId);
        
        router.replace('/(tabs)/dashboard' as Href<string>);
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      Alert.alert('Error', 'Biometric authentication failed');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      // TODO: Replace with real Firebase authentication and token handling
      // For personal app: look up the person by email and persist local state
      const person = await authService.getUserByEmail(email);
      if (!person?.personId || !person?.companyId) {
        throw new Error('User not found or invalid');
      }

      // Persist in store and secure storage
  setPersonId(Number(person.personId));
  setCompanyId(person.companyId);
  setPersonProfile({ email: person.email, firstName: person.firstName, lastName: person.lastName });
  await saveUserData({ personId: person.personId, email: person.email, firstName: person.firstName, lastName: person.lastName });
      await saveCompanyId(person.companyId);

      setLoading(false);
      router.replace('/(tabs)/dashboard' as Href<string>);
    } catch (error) {
      setLoading(false);
      Alert.alert('Login Failed', 'Invalid email or password');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        {showBiometric && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
            >
              <Ionicons name="finger-print" size={24} color="#4A90E2" />
              <Text style={styles.biometricButtonText}>
                Sign in with {biometricType}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.linkButton}>
          <Text style={styles.linkText}>Forgot Password?</Text>
        </TouchableOpacity>
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
    paddingTop: 80,
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  form: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4A90E2',
    gap: 8,
  },
  biometricButtonText: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '500',
  },
});
