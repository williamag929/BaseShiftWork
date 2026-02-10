import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/styles/theme';

export default function PinVerifyScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>PIN Verification</Text>
      <Text style={styles.subtext}>Coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 16,
    color: colors.muted,
  },
});
