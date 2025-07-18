import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', redirectTo: 'clock-shift', pathMatch: 'full' },
      { path: 'clock-shift', loadChildren: () => import('./clock-shift/clock-shift.module').then(m => m.ClockShiftModule) },
      { path: 'areas', loadChildren: () => import('./areas/areas.module').then(m => m.AreasModule) },
      { path: 'locations', loadChildren: () => import('./locations/locations.module').then(m => m.LocationsModule) },
      { path: 'people', loadChildren: () => import('./people/people.module').then(m => m.PeopleModule) },
      { path: 'roles', loadChildren: () => import('./roles/roles.module').then(m => m.RolesModule) },
      { path: 'schedules', loadChildren: () => import('./schedules/schedules.module').then(m => m.SchedulesModule) },
      { path: 'tasks', loadChildren: () => import('./tasks/tasks.module').then(m => m.TasksModule) },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule { }