import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { People } from 'src/app/core/models/people.model';
import { Schedule } from 'src/app/core/models/schedule.model';
import { ScheduleEmployee } from '../models/schedule-employee.model';


@Injectable({
  providedIn: 'root'
})
export class KioskService {
  private selectedEmployeeSource = new BehaviorSubject<People | null>(null);
  selectedEmployee$ = this.selectedEmployeeSource.asObservable();

  private scheduleEmployeeSource = new BehaviorSubject<ScheduleEmployee | null>(null);
  scheduleEmployee$ = this.scheduleEmployeeSource.asObservable();  
  setSelectedEmployee(employee: People | null) {
    this.selectedEmployeeSource.next(employee);
  }

  setscheduleEmployee(schedule: ScheduleEmployee | null)
  {
    this.scheduleEmployeeSource.next(schedule);
  }

  constructor() { }
}
