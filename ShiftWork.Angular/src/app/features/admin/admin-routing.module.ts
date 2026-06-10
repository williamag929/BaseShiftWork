import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CompanyFormComponent } from './components/company-form/company-form.component';
import { CompanyUsersAdminComponent } from './components/company-users-admin/company-users-admin.component';

const routes: Routes = [
  { path: 'company/new', component: CompanyFormComponent },
  { path: 'company/edit/:id', component: CompanyFormComponent },
  { path: 'company-users', component: CompanyUsersAdminComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
