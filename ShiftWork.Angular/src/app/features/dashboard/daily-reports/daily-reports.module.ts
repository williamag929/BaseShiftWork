import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailyReportsRoutingModule } from './daily-reports-routing.module';
import { DailyReportsComponent } from './daily-reports.component';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  declarations: [DailyReportsComponent],
  imports: [CommonModule, DailyReportsRoutingModule, SharedModule]
})
export class DailyReportsModule { }
