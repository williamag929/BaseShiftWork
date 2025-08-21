import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface SummaryShift {
  day: string;
  personId: number;
  personName: string;
  locationId: number;
  locationName: string;
  areaId: number;
  areaName: string;
  minStartTime: string;
  maxEndTime: string;
  breakTime: number;
  totalHours: number;
}

@Injectable({
  providedIn: 'root'
})
export class SummaryShiftService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getSummaryShifts(
    companyId: string,
    startDate: string,
    endDate: string,
    locationId?: number,
    personId?: number
  ): Observable<SummaryShift[]> {
    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    if (locationId) {
      params = params.set('locationId', locationId.toString());
    }

    if (personId) {
      params = params.set('personId', personId.toString());
    }

    return this.http.get<SummaryShift[]>(`${this.apiUrl}/companies/${companyId}/ScheduleShiftSummaries`, { params });
  }
}
