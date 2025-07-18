import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AreasRoutingModule } from './areas-routing.module';
import { AreasComponent } from './areas.component';
import { SharedModule } from '../../../shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    AreasRoutingModule,
    SharedModule,
    ReactiveFormsModule,
  ]
})
export class AreasModule { }