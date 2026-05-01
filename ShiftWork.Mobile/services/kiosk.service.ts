import { apiClient } from './api-client';
import type { KioskQuestionDto, KioskAnswerDto } from '../types/api';

/** Minimal payload the API's POST /api/kiosk/answers endpoint accepts. */
export interface SubmitAnswerPayload {
  shiftEventId: string;
  kioskQuestionId: number;
  answerText: string;
}

export const kioskService = {
  /**
   * Get kiosk questions for a company
   */
  async getKioskQuestions(companyId: string): Promise<KioskQuestionDto[]> {
    return apiClient.get<KioskQuestionDto[]>(`/api/kiosk/${companyId}/questions`);
  },

  /**
   * Submit kiosk answers after a clock event.
   * Each payload item links an answer to the shift event via shiftEventId.
   */
  async submitKioskAnswers(answers: SubmitAnswerPayload[]): Promise<void> {
    return apiClient.post<void>('/api/kiosk/answers', answers);
  },
};
