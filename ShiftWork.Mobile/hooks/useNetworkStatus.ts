import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

type NetState = { isConnected?: boolean; isInternetReachable?: boolean };

// Unknown (undefined) fields are treated as online; only an explicit false counts as offline.
const isOfflineState = (s: NetState | null | undefined): boolean =>
  !!s && (s.isConnected === false || s.isInternetReachable === false);

/**
 * true = offline, false = online, null = not yet known (callers should block
 * publishing but not show an offline banner). A broken network module fails
 * OPEN (online) so publishing is never locked forever.
 */
export function useIsOffline(): boolean | null {
  const [offline, setOffline] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    let gotEvent = false;
    let sub: { remove: () => void } | undefined;
    (async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (active && !gotEvent) setOffline(isOfflineState(state));
      } catch {
        if (active && !gotEvent) setOffline(false); // fail open
      }
    })();
    try {
      sub = Network.addNetworkStateListener((state) => {
        if (!active) return;
        gotEvent = true;
        setOffline(isOfflineState(state));
      });
    } catch {
      /* listener unavailable; the initial check still applies */
    }
    return () => {
      active = false;
      sub?.remove();
    };
  }, []);
  return offline;
}
