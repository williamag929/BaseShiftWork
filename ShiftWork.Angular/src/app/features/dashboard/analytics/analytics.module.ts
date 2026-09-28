import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { SharedModule } from '../../../shared/shared.module';
import { AnalyticsRoutingModule } from './analytics-routing.module';
import { AnalyticsComponent } from './analytics.component';
import { KpiCardsComponent } from './components/kpi-cards.component';
import { DrilldownTableComponent } from './components/drilldown-table.component';

@NgModule({
  declarations: [AnalyticsComponent, KpiCardsComponent, DrilldownTableComponent],
  imports: [
    CommonModule,
    SharedModule,
    AnalyticsRoutingModule,
    // echarts is loaded lazily so it never touches the main bundle
    NgxEchartsModule.forRoot({ echarts: () => import('echarts') }),
  ],
})
export class AnalyticsModule {}
