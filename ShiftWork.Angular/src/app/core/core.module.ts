import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from './services/auth.service';
import { CompanyService } from './services/company.service';
import { LocationService } from './services/location.service';
import { AreaService } from './services/area.service';
import { PeopleService } from './services/people.service';
import { RoleService } from './services/role.service';
import { ScheduleService } from './services/schedule.service';
import { TaskShiftService } from './services/task-shift.service';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    HttpClientModule
  ],
  providers: [
    AuthService,
    CompanyService,
    LocationService,
    AreaService,
    PeopleService,
    RoleService,
    ScheduleService,
    TaskShiftService
  ]
})
export class CoreModule { }
