import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BulletinsRoutingModule } from './bulletins-routing.module';
import { BulletinsComponent } from './bulletins.component';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  declarations: [BulletinsComponent],
  imports: [CommonModule, BulletinsRoutingModule, SharedModule]
})
export class BulletinsModule { }
