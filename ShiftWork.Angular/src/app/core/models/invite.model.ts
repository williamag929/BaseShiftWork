export interface SendInviteRequest {
  roleIds: number[];
  inviteUrl?: string;
}

export interface CompleteInviteRequest {
  inviteToken: string;
  personId: number;
}

export interface InviteStatusResponse {
  hasAppAccess: boolean;
  status: 'None' | 'Pending' | 'Active';
  companyUser?: any;
  profiles: any[];
}

export interface SendInviteResponse {
  inviteToken: string;
  inviteUrl: string;
  expiresAt: Date;
  pendingUser: any;
}
