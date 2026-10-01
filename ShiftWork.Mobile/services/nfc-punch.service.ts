import { apiClient } from './api-client';
import type { LocationDto, NfcPunchRequest, NfcPunchResult, NfcTagLink } from '../types/api';

export const nfcPunchService = {
  punch(companyId: string, request: NfcPunchRequest): Promise<NfcPunchResult> {
    return apiClient.post<NfcPunchResult>(`/api/companies/${companyId}/nfc-punch`, request);
  },

  /** Managers only (locations.update); others get a 403. */
  getTagLinks(companyId: string): Promise<NfcTagLink[]> {
    return apiClient.get<NfcTagLink[]>(`/api/companies/${companyId}/locations/nfc-tags`, {
      params: { noCacheBust: true },
    });
  },

  /** Creates the site's first tag key, or replaces it (the old tag stops working). */
  createTagLink(companyId: string, locationId: number): Promise<LocationDto> {
    return apiClient.post<LocationDto>(`/api/companies/${companyId}/locations/${locationId}/nfc-tag/regenerate`);
  },
};
