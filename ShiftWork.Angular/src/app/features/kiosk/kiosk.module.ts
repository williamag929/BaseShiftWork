import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { WebcamModule } from 'ngx-webcam';

import { KioskComponent } from './kiosk.component';
import { EmployeeListComponent } from './employee-list/employee-list.component';
import { TodoListComponent } from './todo-list/todo-list.component';
import { TodoDetailComponent } from './todo-detail/todo-detail.component';
import { em } from '@fullcalendar/core/internal-common';

const routes: Routes = [
  {
    path: '',
    component: KioskComponent,
    children: [
      { path: 'employee-list', component: EmployeeListComponent },
      { path: 'todo-list', component: TodoListComponent },
      { path: 'todo-detail/:id', component: TodoDetailComponent },
      { path: '', redirectTo: 'employee-list', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  declarations: [

  ],
  imports: [
    CommonModule,
    WebcamModule,
    RouterModule.forChild(routes)
  ]
})
export class KioskModule { }
