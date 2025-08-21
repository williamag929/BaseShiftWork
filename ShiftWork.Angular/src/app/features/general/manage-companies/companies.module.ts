import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { CompaniesRoutingModule } from './companies-routing.module';
import { ManageCompaniesComponent } from './manage-companies.component';
import { CompanyComponent } from '../company/company.component';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  declarations: [
    ManageCompaniesComponent,
    CompanyComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SharedModule,
    CompaniesRoutingModule
  ]
})
export class CompaniesModule { }
