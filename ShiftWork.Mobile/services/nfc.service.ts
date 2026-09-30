import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { parseTagKey } from '@/utils/nfcTag';

export type NfcAvailability = 'ready' | 'disabled' | 'unsupported';

let starting: Promise<void> | null = null;
const ensureStarted = () =>
  (starting ??= NfcManager.start().catch((error) => {
    starting = null;
    throw error;
  }));

const endSession = () => NfcManager.cancelTechnologyRequest().catch(() => undefined);

export const nfcService = {
  async getAvailability(): Promise<NfcAvailability> {
    try {
      if (!(await NfcManager.isSupported())) return 'unsupported';
      await ensureStarted();
      return (await NfcManager.isEnabled()) ? 'ready' : 'disabled';
    } catch {
      return 'unsupported';
    }
  },

  /** Waits for a tag; resolves its Loqzen tag key, or null if it is not a Loqzen tag. Rejects on cancel. */
  async readTagKey(alertMessage: string): Promise<string | null> {
    await ensureStarted();
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage });
      const tag = await NfcManager.getTag();
      for (const record of tag?.ndefMessage ?? []) {
        if (!Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)) continue;
        const key = parseTagKey(Ndef.uri.decodePayload(Uint8Array.from(record.payload)));
        if (key) return key;
      }
      return null;
    } finally {
      await endSession();
    }
  },

  /** Writes one NDEF URI record; `lock` makes the tag read-only afterwards (permanent). */
  async writeTagUrl(url: string, alertMessage: string, lock: boolean): Promise<void> {
    await ensureStarted();
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage });
      const bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
      await NfcManager.ndefHandler.writeNdefMessage(bytes);
      if (lock) await NfcManager.ndefHandler.makeReadOnly();
    } finally {
      await endSession();
    }
  },

  cancel(): Promise<void> {
    return endSession();
  },
};
