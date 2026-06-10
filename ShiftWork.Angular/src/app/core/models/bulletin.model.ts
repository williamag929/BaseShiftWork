export interface Bulletin {
  bulletinId: string;
  companyId: string;
  locationId?: number;
  title: string;
  content: string;
  type: string;
  priority: string;
  attachmentUrls?: string[];
  publishedAt: string;
  expiresAt?: string;
  status: string;
  createdByName: string;
  isReadByCurrentUser: boolean;
  totalReads: number;
  createdAt: string;
}

export interface BulletinRead {
  personId: number;
  personName: string;
  readAt: string;
}

export interface CreateBulletinDto {
  title: string;
  content: string;
  type: string;
  priority: string;
  locationId?: number;
  expiresAt?: string;
  attachmentUrls?: string[];
  status: string;
}

export type UpdateBulletinDto = CreateBulletinDto;
