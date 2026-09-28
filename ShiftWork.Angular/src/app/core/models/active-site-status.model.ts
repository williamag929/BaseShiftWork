export interface ActiveSiteRosterEntry {
  personId: number;
  name: string;
  photoUrl?: string;
  roleName?: string;
  clockInTime: string;
  /** 'Late' | 'Early' | 'OnTime' | 'NoSchedule' */
  timingStatus: string;
  /** 'Inside' | 'Outside' | 'Unknown' */
  geofenceStatus: string;
  geofenceDistanceMeters?: number;
  geofenceReviewed: boolean;
  shiftEventId: string;
}

export interface ActiveSiteStatus {
  locationId: number;
  name: string;
  address: string;
  onShiftCount: number;
  roster: ActiveSiteRosterEntry[];
}
