import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CostCodesComponent } from './cost-codes.component';

const routes: Routes = [
  { path: '', component: CostCodesComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CostCodesRoutingModule { }
