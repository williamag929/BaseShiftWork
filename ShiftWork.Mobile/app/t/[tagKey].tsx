import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { NfcPunchResultView } from '@/components/screens/nfc/NfcPunchResultView';
import { useNfcPunch } from '@/hooks/useNfcPunch';
import { usePendingTagStore } from '@/store/pendingTagStore';
import { isValidTagKey } from '@/utils/nfcTag';
import { getCompanyId, getToken, getUserData } from '@/utils/storage.utils';

type Session = { companyId: string; personId: number };

/** Opened by a tag link (https://t.loqzen.com/t/<key>) or by the in-app scan button. */
export default function NfcTapScreen() {
  const router = useRouter();
  const { tagKey: rawKey } = useLocalSearchParams<{ tagKey: string }>();
  const tagKey = typeof rawKey === 'string' && isValidTagKey(rawKey) ? rawKey : null;
  // undefined = still reading storage; null = signed out.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const { state, punch, reset } = useNfcPunch(session?.companyId ?? null, session?.personId ?? null);

  // Read the stored sign-in directly: a tag can cold-start the app before the root layout restores it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, user, companyId] = await Promise.all([getToken(), getUserData(), getCompanyId()]);
      if (cancelled) return;
      setSession(token && user?.personId && companyId ? { companyId, personId: Number(user.personId) } : null);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (session === null && tagKey) {
      usePendingTagStore.getState().setTagKey(tagKey);
      router.replace('/(auth)/login' as any);
    }
  }, [session, tagKey, router]);

  useEffect(() => {
    if (!session || !tagKey) return;
    reset();
    punch(tagKey);
  }, [session, tagKey, punch, reset]);

  const done = () => router.replace('/(tabs)/clock' as any);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <NfcPunchResultView
        state={tagKey ? state : { status: 'error', kind: 'unknown_tag' }}
        onRetry={() => { if (tagKey) punch(tagKey); }}
        onDone={done}
      />
    </>
  );
}
