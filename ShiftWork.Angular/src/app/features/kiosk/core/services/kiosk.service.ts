import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { People } from 'src/app/core/models/people.model';
import { Schedule } from 'src/app/core/models/schedule.model';
import { ScheduleEmployee } from '../models/schedule-employee.model';
import { Location } from '../../../../core/models/location.model';

@Injectable({
  providedIn: 'root'
})
export class KioskService {

  private selectedLocationSource = new BehaviorSubject<Location | null>(null);
  selectedLocation$ = this.selectedLocationSource.asObservable();

  private selectedEmployeeSource = new BehaviorSubject<People | null>(null);
  selectedEmployee$ = this.selectedEmployeeSource.asObservable();

  private scheduleEmployeeSource = new BehaviorSubject<ScheduleEmployee | null>(null);
  scheduleEmployee$ = this.scheduleEmployeeSource.asObservable();
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


constructor() { }
}
