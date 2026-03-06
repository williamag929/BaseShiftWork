import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RegistrationRoutingModule } from './registration-routing.module';
import { RegistrationComponent } from './registration.component';
import { VerifyEmailComponent } from './verify-email.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [RegistrationComponent, VerifyEmailComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RegistrationRoutingModule,
    SharedModule
  ]
})
export class RegistrationModule {}
