jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  Link: 'Link',
}));
jest.mock('@/hooks/useLogin', () => ({
  useLogin: jest.fn(),
}));
jest.mock('@/styles/tokens', () => ({
  colors: {
    primary: '#007AFF',
    danger: '#FF3B30',
    background: '#fff',
    text: '#000',
    muted: '#888',
    surface: '#F0F0F0',
  },
  spacing: { sm: 8, md: 16, lg: 24, xl: 32 },
  font: { sm: 12, md: 14, lg: 16, xl: 20 },
}));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('@/components/ui/Button', () => ({
  Button: ({ label, onPress }: { label: string; onPress: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress} testID="submit-btn">
        <Text>{label}</Text>
      </Pressable>
    );
  },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin } from '@/hooks/useLogin';

// Helper: create a minimal form stub compatible with the login screen
function makeFormStub() {
  const { Control, handleSubmit } = {} as any;
  return {
    control: {} as Control<any>,
    handleSubmit: jest.fn((cb) => () => cb({ email: '', password: '' })),
    formState: { errors: {} },
  };
}

const mockUseLogin = useLogin as jest.Mock;

describe('LoginScreen', () => {
  beforeEach(() => {
    mockUseLogin.mockReturnValue({
      form: makeFormStub(),
      loading: false,
      showBiometric: false,
      biometricType: null,
      handleLogin: jest.fn(),
      handleBiometricLogin: jest.fn(),
    });
  });

  it('renders email input with correct placeholder', async () => {
    const LoginScreen = require('../../app/(auth)/login').default;
    const { findByPlaceholderText } = render(<LoginScreen />);
    const emailInput = await findByPlaceholderText('Enter your email');
    expect(emailInput).toBeTruthy();
  });

  it('renders password input with correct placeholder', async () => {
    const LoginScreen = require('../../app/(auth)/login').default;
    const { findByPlaceholderText } = render(<LoginScreen />);
    const passwordInput = await findByPlaceholderText('Enter your password');
    expect(passwordInput).toBeTruthy();
  });

  it('shows "Sign In" button when not loading', async () => {
    const LoginScreen = require('../../app/(auth)/login').default;
    const { findByText } = render(<LoginScreen />);
    expect(await findByText('Sign In')).toBeTruthy();
  });
});
