export interface ShiftEvent {
  eventLogId: string;
  eventDate: Date;
  eventType: string | null;
  companyId: string | null;
  personId: number;
  eventObject: string | null;
  description: string | null;
  kioskDevice: string | null;
  geoLocation: string | null;
  photoUrl: string | null;
}
