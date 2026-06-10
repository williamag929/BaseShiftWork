import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CrewsComponent } from './crews.component';

const routes: Routes = [
  { path: '', component: CrewsComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CrewsRoutingModule { }
