import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AdminRoutingModule } from './admin-routing.module';
import { CompanyFormComponent } from './components/company-form/company-form.component';
import { CompanyUsersAdminComponent } from './components/company-users-admin/company-users-admin.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatListModule } from '@angular/material/list';
import { HasPermissionDirective } from 'src/app/core/directives/has-permission.directive';
import { UserLocationScopeDialogComponent } from './components/user-location-scope-dialog/user-location-scope-dialog.component';


@NgModule({
  declarations: [
    CompanyFormComponent,
    CompanyUsersAdminComponent,
    UserLocationScopeDialogComponent
  ],
  imports: [
    CommonModule,
    AdminRoutingModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatTableModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
    MatCheckboxModule,
    MatListModule,
    HasPermissionDirective
  ]
})
export class AdminModule { }
