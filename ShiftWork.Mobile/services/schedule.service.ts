import { apiClient } from './api-client';
import type {
  ScheduleDto,
  ScheduleShiftDto,
  ScheduleSearchParams,
} from '../types/api';

export const scheduleService = {
  /**
   * Get all schedules for a company
   */
  async getSchedules(companyId: string): Promise<ScheduleDto[]> {
    return apiClient.get<ScheduleDto[]>(`/api/companies/${companyId}/schedules`);
  },

  /**
   * Get schedule by ID
   */
  async getScheduleById(companyId: string, scheduleId: number): Promise<ScheduleDto> {
    return apiClient.get<ScheduleDto>(`/api/companies/${companyId}/schedules/${scheduleId}`);
  },

  /**
   * Search schedules with filters
   */
  async searchSchedules(
    companyId: string,
    params: ScheduleSearchParams
  ): Promise<ScheduleDto[]> {
    return apiClient.get<ScheduleDto[]>(`/api/companies/${companyId}/schedules/search`, {
      params,
    });
  },

  /**
   * Get schedule shifts for a company
   */
  async getScheduleShifts(companyId: string): Promise<ScheduleShiftDto[]> {
    try {
      return await apiClient.get<ScheduleShiftDto[]>(`/api/companies/${companyId}/scheduleshifts`);
    } catch (err: any) {
      // Treat 404 (no shifts) as empty result instead of error
      if (err?.statusCode === 404) {
        return [];
      }
      throw err;
    }
  },

  /**
   * Get schedule shift by ID
   */
  async getScheduleShiftById(
    companyId: string,
    shiftId: number
  ): Promise<ScheduleShiftDto> {
    return apiClient.get<ScheduleShiftDto>(
      `/api/companies/${companyId}/scheduleshifts/${shiftId}`
    );
  },

  /**
   * Get shifts for a specific person in a date range
   */
  async getPersonShifts(
    companyId: string,
    personId: number,
    startDate: string,
    endDate: string
  ): Promise<ScheduleShiftDto[]> {
    // Prefer server-side filtering to ensure parity with kiosk
    try {
      const results = await this.searchSchedules(companyId, {
        personId,
        startDate,
        endDate,
      } as any);
      // Some APIs may return ScheduleDto; normalize to shifts array if needed
      // If API already returns ScheduleShiftDto[], cast directly
      return (results as unknown as ScheduleShiftDto[]) ?? [];
    } catch (err: any) {
      if (err?.statusCode === 404) {
        return [];
      }
      // Fallback to client-side filter if search endpoint unavailable
      const allShifts = await this.getScheduleShifts(companyId);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return allShifts.filter(
        (shift) =>
          shift.personId === personId &&
          new Date(shift.startDate as unknown as string) >= start &&
          new Date(shift.startDate as unknown as string) <= end
      );
    }
  },
};
