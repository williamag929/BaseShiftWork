import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { KioskComponent } from './kiosk.component';

const routes: Routes = [
  {
    path: '',
    component: KioskComponent,
    children: [
      { path: '', redirectTo: 'employee-list', pathMatch: 'full' },
      { path: 'employee-list', loadChildren: () => import('./employee-list/employee-list.module').then(m => m.EmployeeListModule) },
      { path: 'photo-schedule', loadChildren: () => import('./photo-schedule/photo-schedule.module').then(m => m.PhotoScheduleModule) },
      { path: 'todo-list', loadChildren: () => import('./todo-list/todo-list.module').then(m => m.TodoListModule) },
      { path: 'todo-detail', loadChildren: () => import('./todo-detail/todo-detail.module').then(m => m.TodoDetailModule) },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class KioskRoutingModule { }