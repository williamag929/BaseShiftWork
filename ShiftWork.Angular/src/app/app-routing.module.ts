import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';


const routes: Routes = [
  // --- Public routes (no auth guard) ---
  { path: 'auth', loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule) },
  // Self-registration disabled: users must be invited by a company admin
  { path: 'register', redirectTo: '/auth/sign-in', pathMatch: 'prefix' },
  { path: 'onboarding', redirectTo: '/auth/sign-in', pathMatch: 'prefix' },

  // --- Authenticated routes ---
  { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.module').then(m => m.DashboardModule), canActivate: [authGuard] },
  { path: 'kiosk', loadChildren: () => import('./features/kiosk/kiosk.module').then(m => m.KioskModule), canActivate: [authGuard] },
  { path: 'company-switch', loadChildren: () => import('./features/company-switch/company-switch.module').then(m => m.CompanySwitchModule), canActivate: [authGuard] },
  { path: 'general', loadChildren: () => import('./features/general/general.module').then(m => m.GeneralModule), canActivate: [authGuard] },
  { path: 'admin', loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule), canActivate: [authGuard] },
  // Plan upgrade page (authenticated)
  { path: 'upgrade', loadChildren: () => import('./features/upgrade/upgrade.module').then(m => m.UpgradeModule), canActivate: [authGuard] },

  // Back-compat redirects for older links
  { path: 'accept-invite', redirectTo: '/auth/accept-invite', pathMatch: 'full' },
  { path: 'forgot-password', redirectTo: '/auth/forgot-password', pathMatch: 'full' },
  { path: 'register-user', redirectTo: '/auth/sign-in', pathMatch: 'full' },
  { path: '', redirectTo: '/auth/sign-in', pathMatch: 'full' },
  { path: '**', redirectTo: '/auth/sign-in' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
