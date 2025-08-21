import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ManageCompaniesComponent } from './manage-companies/manage-companies.component';

const routes: Routes = [
  { path: 'manage-companies', component: ManageCompaniesComponent },
  { path: 'company', redirectTo: 'manage-companies', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class GeneralRoutingModule { }
