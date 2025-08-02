import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';

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
      { path: 'tasks', component: TasksComponent },
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
    SharedModule,
    ReactiveFormsModule,
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
