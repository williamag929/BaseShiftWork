import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CompanySwitchRoutingModule } from './company-switch-routing.module';
import { CompanySwitchComponent } from './company-switch.component';
import { SharedModule } from '../../shared/shared.module';
import { Routes } from '@angular/router';
import { LzAuthShellComponent } from '../../shared/ui';

const routes: Routes = [
  {
    path: '',
    component: CompanySwitchComponent,
  }
];

@NgModule({
  declarations: [
    CompanySwitchComponent
  ],
  imports: [
    CommonModule,
    CompanySwitchRoutingModule,
    SharedModule,
    LzAuthShellComponent
  ]
})
export class CompanySwitchModule { }