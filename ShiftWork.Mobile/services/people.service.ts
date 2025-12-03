import { apiClient } from './api-client';
import type { PersonDto } from '../types/api';

export interface UpdatePersonDto {
  name?: string;
  email?: string;
  phoneNumber?: string;
  photoUrl?: string;
  pin?: string;
  currentPin?: string; // For PIN verification
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

class PeopleService {
  /**
   * Get person details by ID
   */
  async getPersonById(companyId: string, personId: number): Promise<PersonDto> {
    return apiClient.get<PersonDto>(
      `/api/companies/${companyId}/people/${personId}`,
      { params: { noCacheBust: true } }
    );
  }

  /**
   * Update person details
   */
  async updatePerson(
    companyId: string,
    personId: number,
    data: UpdatePersonDto
  ): Promise<PersonDto> {
    return apiClient.put<PersonDto>(
      `/api/companies/${companyId}/people/${personId}`,
      data
    );
  }

  /**
   * Update person PIN (for kiosk access)
   */
  async updatePin(
    companyId: string,
    personId: number,
    currentPin: string,
    newPin: string
  ): Promise<void> {
    return apiClient.put<void>(
      `/api/companies/${companyId}/people/${personId}/pin`,
      { currentPin, newPin }
    );
  }

  /**
   * Verify person PIN
   */
  async verifyPin(
    companyId: string,
    personId: number,
    pin: string
  ): Promise<boolean> {
    try {
      const response = await apiClient.post<{ valid: boolean }>(
        `/api/companies/${companyId}/people/${personId}/verify-pin`,
        { pin }
      );
      return response.valid;
    } catch {
      return false;
    }
  }

  /**
   * Get person status
   */
  async getPersonStatus(companyId: string, personId: number): Promise<string> {
    return apiClient.get<string>(
      `/api/companies/${companyId}/people/${personId}/status`
    );
  }

  /**
   * Upload person photo
   */
  async uploadPersonPhoto(
    companyId: string,
    personId: number,
    photoUrl: string
  ): Promise<PersonDto> {
    return apiClient.patch<PersonDto>(
      `/api/companies/${companyId}/people/${personId}`,
      { photoUrl }
    );
  }

  /**
   * Partial update person (only specified fields)
   */
  async partialUpdatePerson(
    companyId: string,
    personId: number,
    updates: Partial<UpdatePersonDto>
  ): Promise<PersonDto> {
    return apiClient.patch<PersonDto>(
      `/api/companies/${companyId}/people/${personId}`,
      updates
    );
  }
}

export const peopleService = new PeopleService();
