import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhotoScheduleRoutingModule } from './photo-schedule-routing.module';
import { SharedModule } from '../../../shared/shared.module';
import { PhotoScheduleComponent } from './photo-schedule.component';
@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    PhotoScheduleRoutingModule,
    SharedModule
  ],
  exports: []
})
export class PhotoScheduleModule { }