import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SafetyComponent } from './safety.component';

const routes: Routes = [
  { path: '', component: SafetyComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SafetyRoutingModule { }
