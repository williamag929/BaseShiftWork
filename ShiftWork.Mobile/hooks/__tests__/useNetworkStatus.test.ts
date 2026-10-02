jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

import { renderHook, waitFor, act } from '@testing-library/react-native';
import * as Network from 'expo-network';
import { useIsOffline } from '../useNetworkStatus';

const getState = Network.getNetworkStateAsync as jest.Mock;
const addListener = Network.addNetworkStateListener as jest.Mock;
let emit: (s: object) => void;
const remove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  addListener.mockImplementation((cb) => { emit = cb; return { remove }; });
});

describe('useIsOffline', () => {
  it('is null (unknown) first, then online', async () => {
    getState.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    const { result } = renderHook(() => useIsOffline());
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('reports offline when disconnected', async () => {
    getState.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    const { result } = renderHook(() => useIsOffline());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('connected but internet unreachable is offline', async () => {
    getState.mockResolvedValue({ isConnected: true, isInternetReachable: false });
    const { result } = renderHook(() => useIsOffline());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('listener updates flip the state', async () => {
    getState.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    const { result } = renderHook(() => useIsOffline());
    await waitFor(() => expect(result.current).toBe(false));
    act(() => emit({ isConnected: false, isInternetReachable: false }));
    expect(result.current).toBe(true);
    act(() => emit({ isConnected: true, isInternetReachable: true }));
    expect(result.current).toBe(false);
  });

  it('removes the subscription on unmount', async () => {
    getState.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    const { unmount } = renderHook(() => useIsOffline());
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('fails open (online) when the initial check rejects', async () => {
    getState.mockRejectedValue(new Error('native module missing'));
    const { result } = renderHook(() => useIsOffline());
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('a listener event before the initial check resolves wins over the stale result', async () => {
    let resolve!: (v: object) => void;
    getState.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useIsOffline());
    act(() => emit({ isConnected: false, isInternetReachable: false }));
    expect(result.current).toBe(true);
    await act(async () => { resolve({ isConnected: true, isInternetReachable: true }); });
    expect(result.current).toBe(true);
  });
});
