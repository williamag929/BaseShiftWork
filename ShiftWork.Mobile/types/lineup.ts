export interface DefaultShift { start: string; end: string; areaId: number | null }
export interface LineupShift { shiftId: number; personId: number; name: string; start: string; end: string; status: string }
export interface LineupLocation { locationId: number; name: string; defaultShift: DefaultShift | null; shifts: LineupShift[] }
export interface LineupPerson { personId: number; name: string; crewIds: number[] }
export interface LineupUnavailable { personId: number; name: string; reason: string }
export interface LineupCrew { crewId: number; name: string; memberIds: number[] }
export interface Lineup {
  date: string;
  timeZone: string;
  canEdit: boolean;
  locations: LineupLocation[];
  bench: LineupPerson[];
  unavailable: LineupUnavailable[];
  crews: LineupCrew[];
}
export interface LineupAssignment {
  personId: number;
  locationId: number;
  areaId: number | null;
  start: string | null;
  end: string | null;
  acceptWarnings: boolean;
}
export interface LineupCommitRequest { date: string; assignments: LineupAssignment[]; removals: number[] }
export type CommitStatus = 'created' | 'unchanged' | 'needs-confirmation' | 'rejected' | 'removed';
export interface LineupCommitResult {
  status: CommitStatus;
  personId?: number | null;
  locationId?: number | null;
  shiftId?: number | null;
  errors: string[];
  warnings: string[];
}
export interface LineupCommitResponse { results: LineupCommitResult[] }
