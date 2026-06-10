import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfilesRoutingModule } from './profiles-routing.module';
import { ProfilesComponent } from './profiles.component';
import { AssignUsersPanelComponent } from './assign-users-panel.component';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  declarations: [ProfilesComponent],
  imports: [
    CommonModule,
    ProfilesRoutingModule,
    SharedModule,
    AssignUsersPanelComponent,  // standalone component
  ]
})
export class ProfilesModule { }
