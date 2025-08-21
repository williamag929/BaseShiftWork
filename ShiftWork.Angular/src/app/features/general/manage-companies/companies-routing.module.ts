import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ManageCompaniesComponent } from './manage-companies.component';
//import { CompanyComponent } from '../company/company.component';

const routes: Routes = [
  { path: '', component: ManageCompaniesComponent },
 // { path: 'new', component: CompanyComponent },
 // { path: 'edit/:id', component: CompanyComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CompaniesRoutingModule { }
