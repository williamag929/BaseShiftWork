import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpgradeRoutingModule } from './upgrade-routing.module';
import { UpgradeComponent } from './upgrade.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [UpgradeComponent],
  imports: [
    CommonModule,
    UpgradeRoutingModule,
    SharedModule
  ]
})
export class UpgradeModule {}
