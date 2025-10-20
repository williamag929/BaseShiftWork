import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ClockShiftComponent } from './clock-shift.component';
import { WebcamModule } from 'ngx-webcam';

const routes: Routes = [
  {
    path: '',
    component: ClockShiftComponent
  }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ClockShiftComponent
  ]
})
export class ClockShiftModule { }
