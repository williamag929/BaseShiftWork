import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcoreRoutingModule } from './procore-routing.module';
import { ProcoreComponent } from './procore.component';
import { SharedModule } from '../../../shared/shared.module';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@NgModule({
  declarations: [ProcoreComponent],
  imports: [
    CommonModule,
    ProcoreRoutingModule,
    SharedModule,
    ReactiveFormsModule,
    FormsModule,
  ]
})
export class ProcoreModule { }
