import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { CoreApiService } from './core-api.service';
import { Employee } from '../models/employee.model';
import { DataService } from './data.service';
import { AppState } from 'src/app/store/app.state';

@Injectable({
  providedIn: 'root'
})
export class KioskemployeeService extends CoreApiService<Employee> {
  dbPath = 'people';

  constructor(store: Store<AppState>, http: HttpClient, dataService: DataService) {
    super(store, http, dataService);
  }
}
