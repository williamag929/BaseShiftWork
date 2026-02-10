import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Switch, Image } from 'react-native';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { peopleService, biometricAuthService } from '@/services';
import { uploadPhoto } from '@/services/upload.service';
import { Ionicons } from '@expo/vector-icons';
import type { PersonDto } from '@/types/api';
import PhotoCapture from '@/components/PhotoCapture';
import { Card, SectionHeader } from '@/components/ui';
import { colors } from '@/styles/theme';

export default function ProfileScreen() {
  const { companyId, personId, signOut, setPersonProfile } = useAuthStore();
  
  const [person, setPerson] = useState<PersonDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  
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
      setName(data.name || '');
      setEmail(data.email || '');
      setPhoneNumber(data.phoneNumber || '');
      setPhotoUrl(data.photoUrl || '');
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
          name: person.name,
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

  const handlePhotoCapture = async (uri: string) => {
    if (!companyId || !personId) return;

    try {
      setUploadingPhoto(true);
      
      // Upload photo to S3
      const uploadedUrl = await uploadPhoto(uri, 'shiftwork-photos');
      
      // Validate that we got a valid S3 URL, not a local file path
      if (uploadedUrl.startsWith('file://') || uploadedUrl.includes('/var/mobile/')) {
        throw new Error('Upload failed: Got local file path instead of S3 URL');
      }
      
      console.log('Saving S3 URL to database:', uploadedUrl);
      
      // Update profile with new photo URL using partial update
      const updated = await peopleService.partialUpdatePerson(companyId, personId, {
        photoUrl: uploadedUrl,
      });
      
      setPerson(updated);
      setPhotoUrl(uploadedUrl);
      
      // Update auth store
      setPersonProfile({ photoUrl: uploadedUrl });
      
      Alert.alert('Success', 'Photo updated successfully');
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', error.message || 'Failed to update photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!companyId || !personId) return;

    try {
      setSaving(true);
      const updated = await peopleService.updatePerson(companyId, personId, {
        name: name.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
      });
      setPerson(updated);
      setEditMode(false);
      
      // Update auth store
      setPersonProfile({ name: name.trim(), email: email.trim() });
      
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
      setName(person.name || '');
      setEmail(person.email || '');
      setPhoneNumber(person.phoneNumber || '');
      setPhotoUrl(person.photoUrl || '');
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
        <ActivityIndicator size="large" color={colors.primary} />
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
        <TouchableOpacity 
          style={styles.avatarContainer} 
          onPress={() => setShowPhotoCapture(true)}
          disabled={uploadingPhoto}
        >
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} />
          ) : (
            <Ionicons name="person-circle" size={80} color={colors.primary} />
          )}
          <View style={styles.cameraIconContainer}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={20} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.headerName}>
          {person?.name || 'No Name'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {person?.email || 'No email on file'}
        </Text>
        <Text style={styles.photoHint}>
          {uploadingPhoto ? 'Uploading photo…' : 'Tap photo to update'}
        </Text>
      </View>

      {/* Photo Capture Modal */}
      <PhotoCapture
        visible={showPhotoCapture}
        onClose={() => setShowPhotoCapture(false)}
        onCaptured={handlePhotoCapture}
      />

      {/* Profile Information Section */}
      <View style={styles.section}>
        <SectionHeader
          title="Personal Information"
          rightSlot={
            !editMode ? (
              <TouchableOpacity onPress={() => setEditMode(true)} style={styles.editButton}>
                <Ionicons name="pencil" size={20} color={colors.primary} />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            ) : null
          }
        />

        <Card style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={name}
              onChangeText={setName}
              placeholder="Full Name"
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
            {!editMode && !email && (
              <Text style={styles.fieldHint}>No email on file</Text>
            )}
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
            {!editMode && !phoneNumber && (
              <Text style={styles.fieldHint}>No phone number on file</Text>
            )}
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
        </Card>
      </View>

      {/* PIN Change Section */}
      <View style={styles.section}>
        <SectionHeader title="Security" />

        <Card style={styles.card}>
          {/* Biometric Authentication Toggle */}
          {biometricAvailable && (
            <View style={styles.securityOptionRow}>
              <View style={styles.securityOptionLeft}>
                <Ionicons name="finger-print" size={24} color={colors.primary} />
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
                trackColor={{ false: colors.border, true: colors.primary }}
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
              <Ionicons name="lock-closed" size={24} color={colors.primary} />
              <View style={styles.securityOptionText}>
                <Text style={styles.securityOptionTitle}>Change PIN</Text>
                <Text style={styles.securityOptionSubtitle}>
                  Update your 4-digit PIN for kiosk access
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
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
        </Card>
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <Card style={styles.card}>
          <TouchableOpacity onPress={handleSignOut} style={styles.dangerOption}>
            <Ionicons name="log-out" size={24} color={colors.danger} />
            <Text style={styles.dangerOptionText}>Sign Out</Text>
          </TouchableOpacity>
        </Card>
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
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 14,
  },
  header: {
    backgroundColor: colors.primary,
    padding: 32,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#fff',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 6,
  },
  photoHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerRole: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    padding: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButtonText: {
    color: colors.primary,
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
    color: colors.text,
    marginBottom: 8,
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#7A8796',
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  inputDisabled: {
    backgroundColor: colors.background,
    color: colors.muted,
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
    backgroundColor: colors.primary,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: colors.border,
  },
  buttonSecondaryText: {
    color: colors.text,
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
    borderTopColor: colors.border,
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
    color: colors.text,
    marginBottom: 4,
  },
  securityOptionSubtitle: {
    fontSize: 14,
    color: colors.muted,
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
    color: colors.danger,
  },
  footer: {
    padding: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
});
