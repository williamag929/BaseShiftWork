import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ClockShiftRoutingModule } from './clock-shift-routing.module';
import { ClockShiftComponent } from './clock-shift.component';
import { SharedModule } from '../../../shared/shared.module';


@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    ClockShiftRoutingModule,
    SharedModule,
    ClockShiftComponent
  ]
})
export class ClockShiftModule { }