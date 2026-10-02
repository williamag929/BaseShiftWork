import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

type NetState = { isConnected?: boolean; isInternetReachable?: boolean };

// Unknown (undefined) is treated as online; only an explicit false counts as offline.
const isOfflineState = (s: NetState | null | undefined): boolean =>
  !!s && (s.isConnected === false || s.isInternetReachable === false);

/** True when the device reports no connection. Fails open (online) if the module errors. */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let active = true;
    let sub: { remove: () => void } | undefined;
    (async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (active) setOffline(isOfflineState(state));
      } catch {
        /* keep online default */
      }
    })();
    try {
      sub = Network.addNetworkStateListener((state) => {
        if (active) setOffline(isOfflineState(state));
      });
    } catch {
      /* listener unavailable */
    }
    return () => {
      active = false;
      sub?.remove();
    };
  }, []);
  return offline;
}
