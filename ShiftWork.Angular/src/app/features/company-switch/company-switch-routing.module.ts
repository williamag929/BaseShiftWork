import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CompanySwitchComponent } from './company-switch.component';

const routes: Routes = [
  { path: '', component: CompanySwitchComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CompanySwitchRoutingModule { }