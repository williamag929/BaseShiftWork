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
    return apiClient.get<ScheduleShiftDto[]>(`/api/companies/${companyId}/scheduleshifts`);
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
    const schedules = await this.searchSchedules(companyId, {
      personId,
      startDate,
      endDate,
    });
    
    // Get all shifts for these schedules
    const allShifts = await this.getScheduleShifts(companyId);
    return allShifts.filter((shift) =>
      schedules.some((schedule) => schedule.scheduleId === shift.scheduleId)
    );
  },
};
