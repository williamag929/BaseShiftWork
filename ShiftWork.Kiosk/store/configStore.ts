import { create } from 'zustand';
import type { KioskConfig } from '@/types';
import { kioskService } from '@/services/kiosk.service';
import { STRICT_DEFAULT_CONFIG } from '@/services/punchFlow';
import { getJson, setJson } from '@/utils/localStore';

const cacheKey = (companyId: string, locationId: number) =>
  `kiosk_config_v1_${companyId}_${locationId}`;

interface ConfigState {
  /** Strict (PIN and photo required) until a real config is cached or fetched. */
  config: KioskConfig;
  /** Apply the last config saved for this site, or go strict when there is none. */
  loadCached: (companyId: string, locationId: number) => Promise<void>;
  /** Fetch the live config; on any failure keep whatever is current. */
  refresh: (companyId: string, locationId: number) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: STRICT_DEFAULT_CONFIG,

  loadCached: async (companyId, locationId) => {
    set({ config: STRICT_DEFAULT_CONFIG });
    const cached = await getJson<KioskConfig>(cacheKey(companyId, locationId));
    if (cached) set({ config: cached });
  },

  refresh: async (companyId, locationId) => {
    try {
      const config = await kioskService.getConfig(companyId, locationId);
      set({ config });
      await setJson(cacheKey(companyId, locationId), config).catch(() => undefined);
    } catch {
      // Offline or server error: keep the cached (or strict) config.
    }
  },
}));
