import { apiClient } from './api-client';
import type { LocationDto } from '../types/api';

export const locationService = {
  /**
   * Get all locations for a company
   */
  async getLocations(companyId: string): Promise<LocationDto[]> {
    return apiClient.get<LocationDto[]>(`/api/companies/${companyId}/locations`);
  },

  /**
   * Get location by ID
   */
  async getLocationById(companyId: string, locationId: number): Promise<LocationDto> {
    return apiClient.get<LocationDto>(`/api/companies/${companyId}/locations/${locationId}`);
  },
};
