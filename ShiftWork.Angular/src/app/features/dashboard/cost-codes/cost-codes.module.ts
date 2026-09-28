import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CostCodesRoutingModule } from './cost-codes-routing.module';
import { CostCodesComponent } from './cost-codes.component';
import { SharedModule } from '../../../shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [CostCodesComponent],
  imports: [
    CommonModule,
    CostCodesRoutingModule,
    SharedModule,
    ReactiveFormsModule,
  ]
})
export class CostCodesModule { }
