export type CredentialExpiryStatus = 'Valid' | 'ExpiringSoon' | 'Expired';

export interface Credential {
  credentialId: string;
  companyId: string;
  personId: number;
  personName: string;
  name: string;
  type?: string;
  issuingAuthority?: string;
  credentialNumber?: string;
  issueDate?: string;
  expiryDate: string;
  expiryStatus: CredentialExpiryStatus;
  hasDocument: boolean;
  documentViewUrl?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateCredentialDto {
  personId: number;
  name: string;
  type?: string;
  issuingAuthority?: string;
  credentialNumber?: string;
  issueDate?: string;
  expiryDate: string;
  mimeType?: string;
}

export interface UpdateCredentialDto {
  name: string;
  type?: string;
  issuingAuthority?: string;
  credentialNumber?: string;
  issueDate?: string;
  expiryDate: string;
}

export interface InitiateCredentialUploadResponse {
  credentialId: string;
  presignedUploadUrl: string;
  s3Key: string;
}

export interface ExpiringCredentialsSummary {
  expiredCount: number;
  expiringSoonCount: number;
  items: Credential[];
}
