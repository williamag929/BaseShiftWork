import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';
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

  private readonly DEVICE_LOCATION_KEY = 'kiosk_device_location';
  
  private selectedLocationSource = new BehaviorSubject<Location | null>(null);
  selectedLocation$ = this.selectedLocationSource.asObservable();

  private selectedEmployeeSource = new BehaviorSubject<People | null>(null);
  selectedEmployee$ = this.selectedEmployeeSource.asObservable();

  private scheduleEmployeeSource = new BehaviorSubject<ScheduleEmployee | null>(null);
  scheduleEmployee$ = this.scheduleEmployeeSource.asObservable();

  // Emits on-the-fly status updates from photo-schedule to employee list
  private statusUpdateSource = new Subject<{ personId: number; status: string }>();
  statusUpdate$ = this.statusUpdateSource.asObservable();

  constructor(private http: HttpClient) {
    // Load saved device location on service initialization
    const savedLocation = this.getDeviceLocation();
    if (savedLocation) {
      this.selectedLocationSource.next(savedLocation);
    }
  }

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

  emitStatusUpdate(personId: number, status: string) {
    this.statusUpdateSource.next({ personId, status });
  }

  setSelectedLocation(location: Location) {
    this.selectedLocationSource.next(location);
  }

  getSelectedLocation(): Location | null {
    return this.selectedLocationSource.getValue();
  }

  // Device location assignment methods
  saveDeviceLocation(location: Location): void {
    localStorage.setItem(this.DEVICE_LOCATION_KEY, JSON.stringify(location));
    this.selectedLocationSource.next(location);
  }

  getDeviceLocation(): Location | null {
    const saved = localStorage.getItem(this.DEVICE_LOCATION_KEY);
    return saved ? JSON.parse(saved) : null;
  }

  clearDeviceLocation(): void {
    localStorage.removeItem(this.DEVICE_LOCATION_KEY);
    this.selectedLocationSource.next(null);
  }

  hasDeviceLocation(): boolean {
    return !!this.getDeviceLocation();
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
