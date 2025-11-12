import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { DashboardComponent } from './dashboard.component';
import { ProfilesComponent } from './profiles/profiles.component';
import { PeopleComponent } from './people/people.component';
import { AreasComponent } from './areas/areas.component';
import { LocationsComponent } from './locations/locations.component';
import { ScheduleComponent } from './schedule/schedule.component';
import { TasksComponent } from './tasks/tasks.component';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { FullCalendarModule } from '@fullcalendar/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { share } from 'rxjs';
import { SharedModule } from 'src/app/shared/shared.module';
import { ScheduleGridComponent } from './schedule-grid/schedule-grid.component';


const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: 'profiles', component: ProfilesComponent },
      { path: 'people', component: PeopleComponent },
      { path: 'areas', component: AreasComponent },
      { path: 'locations', component: LocationsComponent },
      { path: 'schedule', component: ScheduleComponent },
      { path: 'schedule-grid', component: ScheduleGridComponent },
      { path: 'time-off-approvals', loadComponent: () => import('./time-off-approvals.component').then(m => m.TimeOffApprovalsComponent) },
      { path: 'people-management', loadComponent: () => import('./people-management.component').then(m => m.PeopleManagementComponent) },
      { path: 'tasks', component: TasksComponent },
      { path: 'clock-shift', loadComponent: () => import('./clock-shift/clock-shift.component').then(m => m.ClockShiftComponent) },
      { path: 'shiftsummaries', loadComponent: () => import('./shiftsummaries/shiftsummaries.component').then(m => m.ShiftsummariesComponent) },
      { path: 'company-settings', loadComponent: () => import('./company-settings.component').then(m => m.CompanySettingsComponent) },
      { path: '', redirectTo: 'schedule', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  declarations: [
    AreasComponent,
    //TasksComponent,
    PeopleComponent,
    LocationsComponent,
    DashboardComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    FullCalendarModule,
    RouterModule.forChild(routes),
    // TODO: ProfilesComponent is standalone, and cannot be declared in an NgModule. Did you mean to import it instead?
  ],
  providers: [
    // DateAdapter, // Uncomment if you need a custom date adapter
  ],
  bootstrap: [DashboardComponent]

})
export class DashboardModule { }
