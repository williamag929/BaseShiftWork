import { apiClient } from './api-client';
import type { ShiftEventDto } from '../types/api';
import { ShiftEventTypes } from '../types/api';

export const shiftEventService = {
  /**
   * Get all shift events for a company
   */
  async getShiftEvents(companyId: string): Promise<ShiftEventDto[]> {
    return apiClient.get<ShiftEventDto[]>(`/api/companies/${companyId}/shiftevents`, {
      params: { noCacheBust: true },
    });
  },

  /**
   * Get shift event by ID
   */
  async getShiftEventById(companyId: string, eventLogId: string): Promise<ShiftEventDto> {
    return apiClient.get<ShiftEventDto>(
      `/api/companies/${companyId}/shiftevents/${eventLogId}`,
      { params: { noCacheBust: true } }
    );
  },

  /**
   * Get shift events for a person
   */
  async getPersonShiftEvents(companyId: string, personId: number): Promise<ShiftEventDto[]> {
    return apiClient.get<ShiftEventDto[]>(
      `/api/companies/${companyId}/shiftevents/person/${personId}`,
      { params: { noCacheBust: true } }
    );
  },

  /**
   * Get shift events by event type
   */
  async getShiftEventsByType(
    companyId: string,
    eventType: string
  ): Promise<ShiftEventDto[]> {
    return apiClient.get<ShiftEventDto[]>(
      `/api/companies/${companyId}/shiftevents/eventtype/${eventType}`,
      { params: { noCacheBust: true } }
    );
  },

  /**
   * Create a new shift event (clock in/out)
   */
  async createShiftEvent(companyId: string, event: Partial<ShiftEventDto>): Promise<ShiftEventDto> {
    return apiClient.post<ShiftEventDto>(`/api/companies/${companyId}/shiftevents`, event);
  },

  /**
   * Update a shift event
   */
  async updateShiftEvent(
    companyId: string,
    eventLogId: string,
    event: Partial<ShiftEventDto>
  ): Promise<ShiftEventDto> {
    return apiClient.put<ShiftEventDto>(
      `/api/companies/${companyId}/shiftevents/${eventLogId}`,
      event
    );
  },

  /**
   * Delete a shift event
   */
  async deleteShiftEvent(companyId: string, eventLogId: string): Promise<void> {
    return apiClient.delete<void>(`/api/companies/${companyId}/shiftevents/${eventLogId}`);
  },

  /**
   * Clock in helper
   */
  async clockIn(
    companyId: string,
    personId: number,
    geoLocation?: string,
    photoUrl?: string,
    kioskDevice?: string
  ): Promise<ShiftEventDto> {
    return this.createShiftEvent(companyId, {
      eventDate: new Date(),
      eventType: ShiftEventTypes.ClockIn,
      companyId,
      personId,
      geoLocation,
      photoUrl,
      kioskDevice,
      description: 'Mobile clock in',
    });
  },

  /**
   * Clock out helper
   */
  async clockOut(
    companyId: string,
    personId: number,
    geoLocation?: string,
    photoUrl?: string,
    kioskDevice?: string
  ): Promise<ShiftEventDto> {
    return this.createShiftEvent(companyId, {
      eventDate: new Date(),
      eventType: ShiftEventTypes.ClockOut,
      companyId,
      personId,
      geoLocation,
      photoUrl,
      kioskDevice,
      description: 'Mobile clock out',
    });
  },
};
