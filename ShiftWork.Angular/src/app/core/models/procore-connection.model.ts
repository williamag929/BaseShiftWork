export interface ProcoreConnection {
  companyId: string;
  procoreCompanyId?: string;
  clientId?: string;
  hasClientSecret: boolean;
  baseUrl: string;
  tokenUrl: string;
  enabled: boolean;
  autoPushOnSubmit: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: string;
}

export interface ProcoreConnectionInput {
  procoreCompanyId?: string;
  clientId?: string;
  clientSecret?: string;
  baseUrl?: string;
  tokenUrl?: string;
  enabled: boolean;
  autoPushOnSubmit: boolean;
}

export interface ProcoreSyncResult {
  success: boolean;
  status: string;
  message?: string;
  procoreProjectId?: string;
  workers?: number;
  hours?: number;
}
