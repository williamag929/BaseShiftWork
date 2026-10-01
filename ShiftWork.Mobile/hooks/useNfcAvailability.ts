import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { nfcService, type NfcAvailability } from '@/services/nfc.service';

/** null while checking. Re-checked on return to the app, since people turn NFC on in Settings. */
export function useNfcAvailability(): NfcAvailability | null {
  const [availability, setAvailability] = useState<NfcAvailability | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => nfcService.getAvailability().then((value) => { if (!cancelled) setAvailability(value); });
    check();
    const subscription = AppState.addEventListener('change', (next) => { if (next === 'active') check(); });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return availability;
}
