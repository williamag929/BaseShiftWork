import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TodoDetailRoutingModule } from './todo-detail-routing.module';
import { TodoDetailComponent } from './todo-detail.component';
import { SharedModule } from '../../../shared/shared.module';


@NgModule({
  imports: [
    CommonModule,
    TodoDetailRoutingModule,
    SharedModule,
    TodoDetailComponent // Import standalone component
  ]
})
export class TodoDetailModule { }