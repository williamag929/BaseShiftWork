import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NfcClockPanel } from '../NfcClockPanel';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const base = { siteName: 'North Tower', required: true, scanning: false, onScan: jest.fn() };

it('tells the employee to tap the tag at an NFC-required site and offers the scan button', () => {
  const onScan = jest.fn();
  const { getByText } = render(<NfcClockPanel {...base} availability="ready" onScan={onScan} />);
  getByText('nfc.required_at_site');
  fireEvent.press(getByText('nfc.scan_button'));
  expect(onScan).toHaveBeenCalled();
});

it('explains that a phone without NFC cannot punch at a required site', () => {
  const { getByText, queryByText } = render(<NfcClockPanel {...base} availability="unsupported" />);
  getByText('nfc.unsupported');
  expect(queryByText('nfc.scan_button')).toBeNull();
});

it('asks to turn NFC on when it is off', () => {
  const { getByText } = render(<NfcClockPanel {...base} availability="disabled" />);
  getByText('nfc.disabled');
});

it('shows only the scan button at an optional tagged site', () => {
  const { getByText, queryByText } = render(<NfcClockPanel {...base} required={false} availability="ready" />);
  getByText('nfc.scan_button');
  expect(queryByText('nfc.required_at_site')).toBeNull();
});

it('renders nothing at an optional site when the phone cannot scan', () => {
  const { toJSON } = render(<NfcClockPanel {...base} required={false} availability="unsupported" />);
  expect(toJSON()).toBeNull();
});
