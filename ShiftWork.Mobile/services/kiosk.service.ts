import { apiClient } from './api-client';
import type { KioskQuestionDto, KioskAnswerDto } from '../types/api';

export const kioskService = {
  /**
   * Get kiosk questions for a company
   */
  async getKioskQuestions(companyId: string): Promise<KioskQuestionDto[]> {
    return apiClient.get<KioskQuestionDto[]>(`/api/kiosk/${companyId}/questions`);
  },

  /**
   * Submit kiosk answers
   */
  async submitKioskAnswers(answers: KioskAnswerDto[]): Promise<void> {
    return apiClient.post<void>('/api/kiosk/answers', answers);
  },
};
