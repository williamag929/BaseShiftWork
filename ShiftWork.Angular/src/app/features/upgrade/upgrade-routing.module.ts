import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Kept so existing links to /upgrade (e.g. onboarding) still land somewhere useful.
const routes: Routes = [
  { path: '', redirectTo: '/dashboard/billing', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UpgradeRoutingModule {}
