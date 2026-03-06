import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Crew, CrewMember, CrewMemberAvailability } from '../models/crew.model';

@Injectable({
  providedIn: 'root'
})
export class CrewService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getCrews(companyId: string): Observable<Crew[]> {
    return this.http.get<Crew[]>(`${this.apiUrl}/companies/${companyId}/crews`);
  }

  getCrew(companyId: string, crewId: number): Observable<Crew> {
    return this.http.get<Crew>(`${this.apiUrl}/companies/${companyId}/crews/${crewId}`);
  }

  createCrew(companyId: string, name: string): Observable<Crew> {
    return this.http.post<Crew>(`${this.apiUrl}/companies/${companyId}/crews`, { name, companyId });
  }

  updateCrew(companyId: string, crewId: number, name: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/companies/${companyId}/crews/${crewId}`, { crewId, name, companyId });
  }

  deleteCrew(companyId: string, crewId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/companies/${companyId}/crews/${crewId}`);
  }

  addPersonToCrew(companyId: string, crewId: number, personId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/companies/${companyId}/crews/${crewId}/people/${personId}`, {});
  }

  removePersonFromCrew(companyId: string, crewId: number, personId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/companies/${companyId}/crews/${crewId}/people/${personId}`);
  }

  getCrewMembers(companyId: string, crewId: number): Observable<CrewMember[]> {
    return this.http.get<CrewMember[]>(`${this.apiUrl}/companies/${companyId}/crews/${crewId}/people`);
  }

  getCrewAvailability(
    companyId: string,
    crewId: number,
    startDate: string,
    endDate: string
  ): Observable<CrewMemberAvailability[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get<CrewMemberAvailability[]>(
      `${this.apiUrl}/companies/${companyId}/crews/${crewId}/availability`,
      { params }
    );
  }
}
