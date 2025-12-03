import { Injectable } from '@angular/core';
import { CoreApiService } from './core-api.service';
import { Employee } from '../models/employee.model';

@Injectable({
  providedIn: 'root'
})
export class KioskemployeeService extends CoreApiService<Employee> {
  dbPath = 'people';
}
