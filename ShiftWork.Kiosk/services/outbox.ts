import { useSyncExternalStore } from 'react';
import * as Crypto from 'expo-crypto';
import { kioskService } from '@/services/kiosk.service';
import { getJson, setJson } from '@/utils/localStore';
import { Outbox, type OutboxEntry, type OutboxSnapshot } from '@/services/outbox.service';

const OUTBOX_KEY = 'kiosk_outbox_v1';
const DRAIN_EVERY_MS = 5_000;

/** The single queue for this tablet. Punches are recorded here first and sent in the background. */
export const outbox = new Outbox({
  load: async () => (await getJson<OutboxEntry[]>(OUTBOX_KEY)) ?? [],
  save: (entries) => setJson(OUTBOX_KEY, entries),
  uploadPhoto: (companyId, uri) => kioskService.uploadPhoto(companyId, uri),
  clock: (companyId, request) => kioskService.clock(companyId, request),
  now: () => Date.now(),
  newId: () => Crypto.randomUUID(),
});

/**
 * Loads the saved queue, then tries to send every few seconds. Returns a stop function.
 * The timer also covers what a running drain misses (entries added mid-drain, Undo-hold and
 * backoff expiry) and refreshes the snapshot so the 24h overCap flag updates while idle.
 */
export function startOutboxWorker(): () => void {
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    outbox.refresh();
    void outbox.drain();
  };
  void outbox.init().then(tick);
  const id = setInterval(tick, DRAIN_EVERY_MS);
  return () => {
    stopped = true;
    clearInterval(id);
  };
}

/** Live queue counts for the admin badge and the pending-status overlay. */
export function useOutboxStatus(): OutboxSnapshot {
  return useSyncExternalStore(
    (listener) => outbox.subscribe(listener),
    () => outbox.getSnapshot()
  );
}
