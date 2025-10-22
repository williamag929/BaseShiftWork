import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { People } from 'src/app/core/models/people.model';
import { Schedule } from 'src/app/core/models/schedule.model';
import { ScheduleEmployee } from '../models/schedule-employee.model';
import { Location } from '../../../../core/models/location.model';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { KioskQuestion } from '../models/kiosk-question.model';
import { KioskAnswer } from '../models/kiosk-answer.model';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class KioskService {

  private readonly apiUrl = environment.apiUrl;

  private selectedLocationSource = new BehaviorSubject<Location | null>(null);
  selectedLocation$ = this.selectedLocationSource.asObservable();

  private selectedEmployeeSource = new BehaviorSubject<People | null>(null);
  selectedEmployee$ = this.selectedEmployeeSource.asObservable();

  private scheduleEmployeeSource = new BehaviorSubject<ScheduleEmployee | null>(null);
  scheduleEmployee$ = this.scheduleEmployeeSource.asObservable();

  constructor(private http: HttpClient) { }

  setSelectedEmployee(employee: People | null) {
    this.selectedEmployeeSource.next(employee);
  }

  getSelectedEmployee(): People | null {
    return this.selectedEmployeeSource.getValue();
  }

  setscheduleEmployee(schedule: ScheduleEmployee | null) {
    this.scheduleEmployeeSource.next(schedule);
  }

  getScheduleEmployee(): ScheduleEmployee | null {
    return this.scheduleEmployeeSource.getValue();  
  }

  setSelectedLocation(location: Location) {
    this.selectedLocationSource.next(location);
  }

  getSelectedLocation(): Location | null {
    return this.selectedLocationSource.getValue();
  }

  getKioskQuestions(companyId: string): Observable<KioskQuestion[]> {
    return this.http.get<KioskQuestion[]>(`${this.apiUrl}/kiosk/${companyId}/questions`)
      .pipe(
        catchError(this.handleError)
      );
  }

  postKioskAnswers(answers: KioskAnswer[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/kiosk/answers`, answers)
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Unknown error!';
    if (error.error instanceof ErrorEvent) {
      // Client-side errors
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side errors
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
