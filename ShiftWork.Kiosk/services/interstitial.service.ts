import apiClient from './api-client';

export interface KioskBulletin {
  bulletinId: string;
  title: string;
  content: string;
  priority: string;
  type: string;
}

export interface KioskSafety {
  safetyContentId: string;
  title: string;
  description: string;
  textContent?: string;
  type: string;
  isAcknowledgmentRequired: boolean;
}

export interface PostClockoutPayload {
  urgentBulletins: KioskBulletin[];
  pendingSafety: KioskSafety[];
}

export const interstitialService = {
  async getPostClockout(
    companyId: string,
    personId: number,
    locationId?: number
  ): Promise<PostClockoutPayload> {
    const params: Record<string, any> = { personId };
    if (locationId) params.locationId = locationId;
    const { data } = await apiClient.get<PostClockoutPayload>(
      `/api/kiosk/${companyId}/post-clockout`,
      { params }
    );
    return data;
  },

  async markBulletinRead(companyId: string, bulletinId: string, personId: number): Promise<void> {
    await apiClient.post(
      `/api/kiosk/${companyId}/bulletins/${bulletinId}/mark-read`,
      null,
      { params: { personId } }
    );
  },

  async acknowledgeSafety(companyId: string, safetyContentId: string, personId: number): Promise<void> {
    await apiClient.post(
      `/api/kiosk/${companyId}/safety/${safetyContentId}/acknowledge`,
      null,
      { params: { personId } }
    );
  },
};
