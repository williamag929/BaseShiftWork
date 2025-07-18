import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClockShiftComponent } from './clock-shift.component';

const routes: Routes = [
  { path: '', component: ClockShiftComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClockShiftRoutingModule { }