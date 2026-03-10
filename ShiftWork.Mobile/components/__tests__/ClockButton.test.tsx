jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/styles/tokens', () => ({
  colors: {
    primary: '#007AFF',
    danger: '#FF3B30',
    surface: '#F0F0F0',
  },
  spacing: { xl: 24 },
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ClockButton } from '../screens/clock/ClockButton';

const noop = jest.fn();

describe('ClockButton', () => {
  it('shows "Clock In" when isClockedIn is false', () => {
    const { getByText } = render(
      <ClockButton
        isClockedIn={false}
        loading={false}
        onPress={noop}
        photoUri={null}
        onPhotoPress={noop}
        onRemovePhoto={noop}
      />,
    );
    expect(getByText('Clock In')).toBeTruthy();
  });

  it('shows "Clock Out" when isClockedIn is true', () => {
    const { getByText } = render(
      <ClockButton
        isClockedIn={true}
        loading={false}
        onPress={noop}
        photoUri={null}
        onPhotoPress={noop}
        onRemovePhoto={noop}
      />,
    );
    expect(getByText('Clock Out')).toBeTruthy();
  });

  it('hides text and shows loading ring when loading is true', () => {
    const { queryByText } = render(
      <ClockButton
        isClockedIn={false}
        loading={true}
        onPress={noop}
        photoUri={null}
        onPhotoPress={noop}
        onRemovePhoto={noop}
      />,
    );
    expect(queryByText('Clock In')).toBeNull();
    expect(queryByText('Clock Out')).toBeNull();
  });

  it('calls onPress when the button is pressed', () => {
    const handlePress = jest.fn();
    const { getByText } = render(
      <ClockButton
        isClockedIn={false}
        loading={false}
        onPress={handlePress}
        photoUri={null}
        onPhotoPress={noop}
        onRemovePhoto={noop}
      />,
    );
    fireEvent.press(getByText('Clock In'));
    expect(handlePress).toHaveBeenCalledTimes(1);
  });
});
