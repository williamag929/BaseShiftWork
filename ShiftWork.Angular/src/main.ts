import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

import { getAllDataFromLocalForage } from 'ngrx-store-persist';

if (environment.production) {
  enableProdMode();
}

getAllDataFromLocalForage({
  keys: [
    'user',
    'post',
    'auth',
    'preferences',
    'company', // Ensure 'companyState' is included if you want to persist it
    'companies', // Ensure 'companies' is included if you want to persist it
    'activeCompany' // Include if you want to persist the active company
  ],
})
  .then(() => platformBrowserDynamic().bootstrapModule(AppModule))
  .catch(err => console.error(err));
  

