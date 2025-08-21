import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', redirectTo: 'clock-shift', pathMatch: 'full' },
      { path: 'clock-shift', loadChildren: () => import('./clock-shift/clock-shift.module').then(m => m.ClockShiftModule) },
      { path: 'areas', loadChildren: () => import('./areas/areas.module').then(m => m.AreasModule) },
      { path: 'locations', loadChildren: () => import('./locations/locations.module').then(m => m.LocationsModule) },
      { path: 'people', loadChildren: () => import('./people/people.module').then(m => m.PeopleModule) },
      { path: 'roles', loadChildren: () => import('./roles/roles.module').then(m => m.RolesModule) },
      { path: 'schedules', loadChildren: () => import('./schedules/schedules.module').then(m => m.SchedulesModule) },
      { path: 'tasks', loadChildren: () => import('./tasks/tasks.module').then(m => m.TasksModule) },
      

      //{ path: 'holidays', loadChildren: () => import('./holidays/holidays.module').then(m => m.HolidaysModule) },
      //{ path: 'companies', loadChildren: () => import('../general/companies/companies.module').then(m => m.CompaniesModule) },
      //{ path: 'settings', loadChildren: () => import('./settings/settings.module').then(m => m.SettingsModule) },
      //{ path: 'help', loadChildren: () => import('./help/help.module').then(m => m.HelpModule) },
      //{ path: 'about', loadChildren: () => import('./about/about.module').then(m => m.AboutModule) },
      //{ path: 'contact', loadChildren: () => import('./contact/contact.module').then(m => m.ContactModule) },
      //{ path: 'privacy', loadChildren: () => import('./privacy/privacy.module').then(m => m.PrivacyModule) },
      //{ path: 'terms', loadChildren: () => import('./terms/terms.module').then(m => m.TermsModule) }, 

      { path: 'kiosk', loadChildren: () => import('../kiosk/kiosk.module').then(m => m.KioskModule) },
      { path: 'kiosks/employee-list', redirectTo: 'kiosks/employee-list', pathMatch: 'full' },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule { }