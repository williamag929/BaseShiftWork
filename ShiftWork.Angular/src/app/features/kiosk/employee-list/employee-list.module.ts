import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeeListRoutingModule } from './employee-list-routing.module';
import { SharedModule } from '../../../shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';


@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    SharedModule,
    EmployeeListRoutingModule,
    ReactiveFormsModule
  ]
})
export class EmployeeListModule { }