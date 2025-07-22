import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PeopleRoutingModule } from './people-routing.module';
import { PeopleComponent } from './people.component';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  declarations: [
    //PeopleComponent
  ],
  imports: [
    CommonModule,
    PeopleRoutingModule,
    SharedModule,
    ReactiveFormsModule
  ]
})
export class PeopleModule { }