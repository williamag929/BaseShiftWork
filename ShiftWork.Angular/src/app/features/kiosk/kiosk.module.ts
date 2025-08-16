import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';


import { KioskComponent } from './kiosk.component';
import { EmployeeListComponent } from './employee-list/employee-list.component';
import { TodoListComponent } from './todo-list/todo-list.component';
import { TodoDetailComponent } from './todo-detail/todo-detail.component';
import { em } from '@fullcalendar/core/internal-common';
import { SharedModule } from 'src/app/shared/shared.module';
import { RouterOutlet } from "@angular/router";
import { DatePipe } from '@angular/common';
import { AnalogClockComponent } from "./analog-clock/analog-clock.component";


const routes: Routes = [
  {
    path: '',
    component: KioskComponent,
    children: [
      { path: 'employee-list', component: EmployeeListComponent },
      { path: 'todo-list', component: TodoListComponent },
      { path: 'todo-detail/:id', component: TodoDetailComponent },
      { path: 'photo-schedule', loadChildren: () => import('./photo-schedule/photo-schedule.module').then(m => m.PhotoScheduleModule) },
      { path: '', redirectTo: 'employee-list', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  declarations: [
    KioskComponent,
    EmployeeListComponent,
    TodoListComponent,
    TodoDetailComponent,
    AnalogClockComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    DatePipe,
    RouterOutlet,
    RouterModule.forChild(routes),
    
  ]
})
export class KioskModule { }
