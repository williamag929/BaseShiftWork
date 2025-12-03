import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PhotoScheduleComponent } from './photo-schedule.component';

const routes: Routes = [
  { path: '', component: PhotoScheduleComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PhotoScheduleRoutingModule { }