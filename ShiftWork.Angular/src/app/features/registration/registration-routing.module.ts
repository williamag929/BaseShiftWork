import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RegistrationComponent } from './registration.component';
import { VerifyEmailComponent } from './verify-email.component';

const routes: Routes = [
  { path: '', component: RegistrationComponent },
  { path: 'verify', component: VerifyEmailComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RegistrationRoutingModule {}
