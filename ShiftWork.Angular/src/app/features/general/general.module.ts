import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GeneralRoutingModule } from './general-routing.module';
import { ManageCompaniesComponent } from './manage-companies/manage-companies.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule,
    GeneralRoutingModule,
    ManageCompaniesComponent
  ]
})
export class GeneralModule { }