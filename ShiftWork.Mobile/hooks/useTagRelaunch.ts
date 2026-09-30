import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { parseTagKey } from '@/utils/nfcTag';

/** Calls onRelaunch when the OS re-delivers this screen's own tag link (same tag tapped again while it is open). */
export function useTagRelaunch(tagKey: string | null, onRelaunch: () => void) {
  const callback = useRef(onRelaunch);
  callback.current = onRelaunch;

  useEffect(() => {
    if (!tagKey) return;
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (parseTagKey(url) === tagKey) callback.current();
    });
    return () => sub.remove();
  }, [tagKey]);
}
