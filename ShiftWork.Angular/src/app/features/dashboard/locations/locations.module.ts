import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LocationsRoutingModule } from './locations-routing.module';
import { LocationsComponent } from './locations.component';
import { SharedModule } from '../../../shared/shared.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { F } from '@angular/cdk/scrolling-module.d-ud2XrbF8';
import { GoogleMap, MapCircle, MapMarker } from '@angular/google-maps';


@NgModule({
  declarations: [
  ],  
  imports: [
    CommonModule,
    LocationsRoutingModule,
    SharedModule,
    ReactiveFormsModule,
    FormsModule,
     GoogleMap, MapMarker, MapCircle
    

  ]
})
export class LocationsModule { }