import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { CoreApiService } from './core-api.service';
import { Task } from '../models/task.model';
import { DataService } from './data.service';
import { AppState } from 'src/app/store/app.state';

@Injectable({
  providedIn: 'root',
})
export class ToDoService extends CoreApiService<Task> {
  dbPath = 'taskshift';

  constructor(store: Store<AppState>, http: HttpClient, dataService: DataService) {
    super(store, http, dataService);
  }
} 