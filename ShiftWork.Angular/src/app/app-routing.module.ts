import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';


const routes: Routes = [
  { path: 'auth', loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule) },
  { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.module').then(m => m.DashboardModule), canActivate: [authGuard] },
  { path: 'kiosk', loadChildren: () => import('./features/kiosk/kiosk.module').then(m => m.KioskModule), canActivate: [authGuard] },
  { path: 'company-switch', loadChildren: () => import('./features/company-switch/company-switch.module').then(m => m.CompanySwitchModule), canActivate: [authGuard] },
  { path: '', redirectTo: '/auth/sign-in', pathMatch: 'full' },
  { path: '**', redirectTo: '/auth/sign-in' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
