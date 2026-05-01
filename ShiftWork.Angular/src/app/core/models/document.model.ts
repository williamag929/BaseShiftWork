export interface Document {
  documentId: string;
  companyId: string;
  locationId?: number;
  title: string;
  description?: string;
  type: string;
  mimeType: string;
  fileSize: number;
  version: string;
  tags?: string[];
  accessLevel: string;
  status: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends Document {
  presignedUrl: string;
  totalReads: number;
}

export interface DocumentReadLog {
  personId: number;
  personName: string;
  readAt: string;
}

export interface UploadDocumentDto {
  title: string;
  description?: string;
  type: string;
  locationId?: number;
  version: string;
  tags?: string[];
  accessLevel: string;
  allowedRoleIds?: number[];
  mimeType: string;
  fileSize: number;
}

export interface InitiateUploadResponse {
  documentId: string;
  presignedUploadUrl: string;
  s3Key: string;
}

export interface UpdateDocumentDto {
  title: string;
  description?: string;
  type: string;
  locationId?: number;
  version: string;
  tags?: string[];
  accessLevel: string;
  allowedRoleIds?: number[];
}
