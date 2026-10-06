jest.mock('@/hooks/queries', () => ({
  useNfcTagLinks: jest.fn(),
  nfcTagLinksKey: (companyId: string) => ['nfcTagLinks', companyId],
}));
jest.mock('@/hooks/useNfcAvailability', () => ({ useNfcAvailability: jest.fn(() => 'ready') }));
jest.mock('@/services/nfc.service', () => ({ nfcService: { writeTagUrl: jest.fn(), cancel: jest.fn() } }));
jest.mock('@/services/nfc-punch.service', () => ({ nfcPunchService: { createTagLink: jest.fn() } }));
jest.mock('@/store/authStore', () => ({ useAuthStore: jest.fn(() => ({ companyId: 'co' })) }));
jest.mock('@/hooks/useToast', () => {
  const toast = { success: jest.fn(), error: jest.fn() };
  return { useToast: () => toast, __toast: toast };
});
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 's' },
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNfcTagLinks } from '@/hooks/queries';
import { useNfcAvailability } from '@/hooks/useNfcAvailability';
import { nfcService } from '@/services/nfc.service';
import { nfcPunchService } from '@/services/nfc-punch.service';
import WriteTagScreen from '../../app/nfc/write-tag';

const toast = jest.requireMock('@/hooks/useToast').__toast;
const links = [
  { locationId: 1, name: 'North Tower', requireNfc: true, tagUrl: 'https://t.loqzen.com/t/AAAAAAAAAAAAAAAAAAAAAA', nfcLastTappedAt: null },
  { locationId: 2, name: 'Depot', requireNfc: false, tagUrl: null, nfcLastTappedAt: null },
];

function renderScreen() {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}><WriteTagScreen /></QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  (useNfcTagLinks as jest.Mock).mockReturnValue({ data: links, isLoading: false, error: null });
  (useNfcAvailability as jest.Mock).mockReturnValue('ready');
});

it('writes the chosen site link without locking by default', async () => {
  const { getByText } = renderScreen();
  fireEvent.press(getByText('North Tower'));
  await act(async () => { fireEvent.press(getByText('nfc.write_button')); });

  expect(nfcService.writeTagUrl).toHaveBeenCalledWith(links[0].tagUrl, 'nfc.write_prompt', false);
  expect(toast.success).toHaveBeenCalledWith('nfc.write_success');
});

it('locks the tag when the switch is on', async () => {
  const { getByText, getByRole } = renderScreen();
  fireEvent.press(getByText('North Tower'));
  fireEvent(getByRole('switch'), 'valueChange', true);
  await act(async () => { fireEvent.press(getByText('nfc.write_button')); });

  expect(nfcService.writeTagUrl).toHaveBeenCalledWith(links[0].tagUrl, 'nfc.write_prompt', true);
});

it('offers to create a link for a site without one', async () => {
  (nfcPunchService.createTagLink as jest.Mock).mockResolvedValue({});
  const { getByText, queryByText } = renderScreen();
  fireEvent.press(getByText('Depot'));
  expect(queryByText('nfc.write_button')).toBeNull();
  await act(async () => { fireEvent.press(getByText('nfc.write_create_link')); });

  expect(nfcPunchService.createTagLink).toHaveBeenCalledWith('co', 2);
});

it('reports a failed write', async () => {
  (nfcService.writeTagUrl as jest.Mock).mockRejectedValue(new Error('tag lost'));
  const { getByText } = renderScreen();
  fireEvent.press(getByText('North Tower'));
  await act(async () => { fireEvent.press(getByText('nfc.write_button')); });

  expect(toast.error).toHaveBeenCalledWith('nfc.write_failed');
});

it('tells non-managers that only managers can write tags', () => {
  (useNfcTagLinks as jest.Mock).mockReturnValue({ data: undefined, isLoading: false, error: { statusCode: 403 } });
  const { getByText } = renderScreen();
  getByText('nfc.write_managers_only');
});

it('explains when the phone cannot write tags', () => {
  (useNfcAvailability as jest.Mock).mockReturnValue('unsupported');
  const { getByText } = renderScreen();
  getByText('nfc.unsupported');
});

it('cancels a pending write when the screen unmounts', () => {
  const { unmount } = renderScreen();
  expect(nfcService.cancel).not.toHaveBeenCalled();
  unmount();
  expect(nfcService.cancel).toHaveBeenCalled();
});

it('cancels a write in progress from the Cancel button', async () => {
  (nfcService.writeTagUrl as jest.Mock).mockReturnValue(new Promise(() => {}));
  const { getByText } = renderScreen();
  fireEvent.press(getByText('North Tower'));
  await act(async () => { fireEvent.press(getByText('nfc.write_button')); });
  fireEvent.press(getByText('common.cancel'));
  expect(nfcService.cancel).toHaveBeenCalled();
});

it('resets the lock switch when another site is selected', () => {
  (useNfcTagLinks as jest.Mock).mockReturnValue({
    data: [links[0], { ...links[0], locationId: 3, name: 'Annex' }], isLoading: false, error: null,
  });
  const { getByText, getByRole } = renderScreen();
  fireEvent.press(getByText('North Tower'));
  fireEvent(getByRole('switch'), 'valueChange', true);
  expect(getByRole('switch').props.value).toBe(true);
  fireEvent.press(getByText('Annex'));
  expect(getByRole('switch').props.value).toBe(false);
});
