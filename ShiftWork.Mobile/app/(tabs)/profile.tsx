import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { peopleService, biometricAuthService } from '@/services';
import { Ionicons } from '@expo/vector-icons';
import type { PersonDto } from '@/types/api';

export default function ProfileScreen() {
  const { companyId, personId, signOut } = useAuthStore();
  
  const [person, setPerson] = useState<PersonDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  
  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // PIN change fields
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    loadProfile();
    checkBiometricAvailability();
  }, [companyId, personId]);

  const checkBiometricAvailability = async () => {
    try {
      const available = await biometricAuthService.isAvailable();
      const enrolled = await biometricAuthService.isEnrolled();
      const enabled = await biometricAuthService.isBiometricEnabled();
      const types = await biometricAuthService.getSupportedTypes();
      const typeName = biometricAuthService.getAuthTypeName(types);
      
      setBiometricAvailable(available && enrolled);
      setBiometricEnabled(enabled);
      setBiometricType(typeName);
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    }
  };

  const loadProfile = async () => {
    if (!companyId || !personId) return;
    
    try {
      setLoading(true);
      const data = await peopleService.getPersonById(companyId, personId);
      setPerson(data);
      setFirstName(data.firstName || '');
      setLastName(data.lastName || '');
      setEmail(data.email || '');
      setPhoneNumber(data.phoneNumber || '');
    } catch (error: any) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', error.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    await checkBiometricAvailability();
    setRefreshing(false);
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (!companyId || !personId || !person) return;

    try {
      if (value) {
        // Enable biometric
        const success = await biometricAuthService.enableBiometric({
          email: person.email || '',
          personId: personId,
          companyId: companyId,
          firstName: person.firstName,
          lastName: person.lastName,
        });
        
        if (success) {
          setBiometricEnabled(true);
          Alert.alert('Success', `${biometricType} login enabled`);
        } else {
          Alert.alert('Failed', `Could not enable ${biometricType} login`);
        }
      } else {
        // Disable biometric
        await biometricAuthService.disableBiometric();
        setBiometricEnabled(false);
        Alert.alert('Success', `${biometricType} login disabled`);
      }
    } catch (error: any) {
      console.error('Error toggling biometric:', error);
      Alert.alert('Error', error.message || 'Failed to update biometric settings');
    }
  };

  const handleSaveProfile = async () => {
    if (!companyId || !personId) return;

    try {
      setSaving(true);
      const updated = await peopleService.updatePerson(companyId, personId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
      });
      setPerson(updated);
      setEditMode(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (person) {
      setFirstName(person.firstName || '');
      setLastName(person.lastName || '');
      setEmail(person.email || '');
      setPhoneNumber(person.phoneNumber || '');
    }
    setEditMode(false);
  };

  const handleChangePin = async () => {
    if (!companyId || !personId) return;

    if (!currentPin || !newPin || !confirmPin) {
      Alert.alert('Validation Error', 'Please fill in all PIN fields');
      return;
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      Alert.alert('Validation Error', 'PIN must be exactly 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      Alert.alert('Validation Error', 'New PIN and confirmation do not match');
      return;
    }

    try {
      setSaving(true);
      await peopleService.updatePin(companyId, personId, currentPin, newPin);
      setChangingPin(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      Alert.alert('Success', 'PIN changed successfully');
    } catch (error: any) {
      console.error('Error changing PIN:', error);
      Alert.alert('Error', error.message || 'Failed to change PIN. Please check your current PIN.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ]
    );
  };

  if (loading && !person) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={80} color="#4A90E2" />
        </View>
        <Text style={styles.headerName}>
          {person?.firstName} {person?.lastName}
        </Text>
        <Text style={styles.headerRole}>Person ID: {personId}</Text>
      </View>

      {/* Profile Information Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          {!editMode && (
            <TouchableOpacity onPress={() => setEditMode(true)} style={styles.editButton}>
              <Ionicons name="pencil" size={20} color="#4A90E2" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>First Name</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First Name"
              editable={editMode}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Last Name</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last Name"
              editable={editMode}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={editMode}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Phone Number"
              keyboardType="phone-pad"
              editable={editMode}
            />
          </View>

          {editMode && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={handleCancelEdit}
                style={[styles.button, styles.buttonSecondary]}
                disabled={saving}
              >
                <Text style={styles.buttonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveProfile}
                style={[styles.button, styles.buttonPrimary]}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonPrimaryText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* PIN Change Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Security</Text>
        </View>

        <View style={styles.card}>
          {/* Biometric Authentication Toggle */}
          {biometricAvailable && (
            <View style={styles.securityOptionRow}>
              <View style={styles.securityOptionLeft}>
                <Ionicons name="finger-print" size={24} color="#4A90E2" />
                <View style={styles.securityOptionText}>
                  <Text style={styles.securityOptionTitle}>{biometricType} Login</Text>
                  <Text style={styles.securityOptionSubtitle}>
                    Use {biometricType.toLowerCase()} to sign in quickly
                  </Text>
                </View>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: '#d1d1d6', true: '#4A90E2' }}
                thumbColor="#fff"
              />
            </View>
          )}

          {/* PIN Change */}
          {!changingPin ? (
            <TouchableOpacity
              onPress={() => setChangingPin(true)}
              style={[styles.securityOption, biometricAvailable && styles.securityOptionBordered]}
            >
              <Ionicons name="lock-closed" size={24} color="#4A90E2" />
              <View style={styles.securityOptionText}>
                <Text style={styles.securityOptionTitle}>Change PIN</Text>
                <Text style={styles.securityOptionSubtitle}>
                  Update your 4-digit PIN for kiosk access
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          ) : (
            <View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Current PIN</Text>
                <TextInput
                  style={styles.input}
                  value={currentPin}
                  onChangeText={setCurrentPin}
                  placeholder="Enter current PIN"
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>New PIN</Text>
                <TextInput
                  style={styles.input}
                  value={newPin}
                  onChangeText={setNewPin}
                  placeholder="Enter new 4-digit PIN"
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Confirm New PIN</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  placeholder="Re-enter new PIN"
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  onPress={() => {
                    setChangingPin(false);
                    setCurrentPin('');
                    setNewPin('');
                    setConfirmPin('');
                  }}
                  style={[styles.button, styles.buttonSecondary]}
                  disabled={saving}
                >
                  <Text style={styles.buttonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleChangePin}
                  style={[styles.button, styles.buttonPrimary]}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.buttonPrimaryText}>Update PIN</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <View style={styles.card}>
          <TouchableOpacity onPress={handleSignOut} style={styles.dangerOption}>
            <Ionicons name="log-out" size={24} color="#E74C3C" />
            <Text style={styles.dangerOptionText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* App Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>ShiftWork Mobile</Text>
        <Text style={styles.footerText}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#4A90E2',
    padding: 32,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  headerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerRole: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButtonText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  inputDisabled: {
    backgroundColor: '#f8f9fa',
    color: '#666',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#4A90E2',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#e9ecef',
  },
  buttonSecondaryText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  securityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 4,
  },
  securityOptionBordered: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 16,
    marginTop: 12,
  },
  securityOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  securityOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  securityOptionText: {
    flex: 1,
  },
  securityOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  securityOptionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  dangerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  dangerOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
  footer: {
    padding: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
});
