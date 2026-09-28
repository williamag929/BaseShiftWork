import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProcoreComponent } from './procore.component';

const routes: Routes = [
  { path: '', component: ProcoreComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProcoreRoutingModule { }
