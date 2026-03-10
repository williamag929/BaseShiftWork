export interface Crew {
  crewId: number;
  name: string;
  companyId: string;
}

export interface CrewMember {
  personId: number;
  name: string;
  photoUrl?: string;
}

export interface CrewMemberAvailability {
  personId: number;
  name: string;
  photoUrl?: string;
  available: boolean;
  reason: 'conflict' | 'time-off' | null;
}
