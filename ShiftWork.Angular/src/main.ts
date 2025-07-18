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
    'posts'
  ],
})
  .then(() => platformBrowserDynamic().bootstrapModule(AppModule))
  .catch(err => console.error(err));
