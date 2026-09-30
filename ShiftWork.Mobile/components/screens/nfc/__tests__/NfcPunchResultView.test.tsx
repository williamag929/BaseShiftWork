import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NfcPunchResultView } from '../NfcPunchResultView';

const success = (over: Record<string, unknown> = {}) => ({
  status: 'success' as const,
  result: {
    eventLogId: 'e', eventType: 'clockin' as const, eventDate: '2026-09-30T12:00:00Z', locationId: 10,
    locationName: 'North Tower', geofenceStatus: 'Inside', repeated: false, ...over,
  },
});

it('shows the sending state', () => {
  const { getByText } = render(<NfcPunchResultView state={{ status: 'sending' }} onRetry={jest.fn()} onDone={jest.fn()} />);
  getByText('nfc.sending');
});

it('shows clocked in with Done and no Undo', () => {
  const onDone = jest.fn();
  const { getByText, queryByText } = render(<NfcPunchResultView state={success()} onRetry={jest.fn()} onDone={onDone} />);
  getByText('nfc.clocked_in');
  fireEvent.press(getByText('nfc.done'));
  expect(onDone).toHaveBeenCalled();
  expect(queryByText(/undo/i)).toBeNull();
  expect(queryByText('nfc.outside_site')).toBeNull();
});

it('shows clocked out, the repeat note and the outside note', () => {
  const { getByText } = render(
    <NfcPunchResultView state={success({ eventType: 'clockout', repeated: true, geofenceStatus: 'Outside' })} onRetry={jest.fn()} onDone={jest.fn()} />,
  );
  getByText('nfc.clocked_out');
  getByText('nfc.already_recorded');
  getByText('nfc.outside_site');
});

it('offers Try again when offline', () => {
  const onRetry = jest.fn();
  const { getByText } = render(
    <NfcPunchResultView state={{ status: 'error', kind: 'offline' }} onRetry={onRetry} onDone={jest.fn()} />,
  );
  getByText('nfc.error_offline');
  fireEvent.press(getByText('nfc.try_again'));
  expect(onRetry).toHaveBeenCalled();
});

it('does not offer Try again for an unknown tag', () => {
  const { getByText, queryByText } = render(
    <NfcPunchResultView state={{ status: 'error', kind: 'unknown_tag' }} onRetry={jest.fn()} onDone={jest.fn()} />,
  );
  getByText('nfc.error_unknown_tag');
  expect(queryByText('nfc.try_again')).toBeNull();
});

it('shows the server message for other failures', () => {
  const { getByText } = render(
    <NfcPunchResultView state={{ status: 'error', kind: 'failed', message: 'Person is already OnShift.' }} onRetry={jest.fn()} onDone={jest.fn()} />,
  );
  getByText('nfc.error_failed');
  getByText('Person is already OnShift.');
});
