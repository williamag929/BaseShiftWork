import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';
import { CompanyEffects } from './store/company/company.effects';
import { environment } from 'src/environments/environment';
import { ReactiveFormsModule } from '@angular/forms';
import { ToastrModule } from 'ngx-toastr';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { storageSyncMetaReducer } from 'ngrx-store-persist';
import { ActionReducer, MetaReducer } from '@ngrx/store';
import { AppState, appReducers } from './store/app.state';
import { metaReducers } from './store/meta-reducers';
import { getAllDataFromLocalForage } from 'ngrx-store-persist';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    ToastrModule.forRoot({
      timeOut: 3000,
      positionClass: 'toast-bottom-right',
      preventDuplicates: true,
      //closeButton: true,
      //progressBar: true,
      //progressAnimation: 'decreasing'
    }),
    NgbModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFirestoreModule,
    AppRoutingModule,
    CoreModule,
    SharedModule,
    ReactiveFormsModule,
    StoreModule.forRoot(appReducers, { metaReducers: [storageSyncMetaReducer] }),
    EffectsModule.forRoot([CompanyEffects]),
    StoreDevtoolsModule.instrument({ maxAge: 25, logOnly: environment.production })
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,

    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
