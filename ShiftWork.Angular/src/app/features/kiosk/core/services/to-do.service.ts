import { Injectable } from '@angular/core';
import { CoreApiService } from './core-api.service';
import { Task } from '../models/task.model';

@Injectable({
  providedIn: 'root',
})
export class ToDoService extends CoreApiService<Task> {
  dbPath = 'taskshift';
} 