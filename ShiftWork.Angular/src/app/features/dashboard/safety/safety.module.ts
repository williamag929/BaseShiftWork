import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafetyRoutingModule } from './safety-routing.module';
import { SafetyComponent } from './safety.component';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  declarations: [SafetyComponent],
  imports: [CommonModule, SafetyRoutingModule, SharedModule]
})
export class SafetyModule { }
