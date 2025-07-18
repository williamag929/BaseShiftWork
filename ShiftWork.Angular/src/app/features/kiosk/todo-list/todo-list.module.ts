import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TodoListRoutingModule } from './todo-list-routing.module';
import { TodoListComponent } from './todo-list.component';
import { SharedModule } from '../../../shared/shared.module';


@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    TodoListRoutingModule,
    SharedModule
  ]
})
export class TodoListModule { }