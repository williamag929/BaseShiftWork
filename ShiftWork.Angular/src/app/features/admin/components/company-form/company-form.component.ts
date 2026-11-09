import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import {
  LzAlertComponent, LzButtonDirective, LzFieldComponent, LzFieldDirective, LzPageHeaderComponent, LzPanelComponent,
} from 'src/app/shared/ui';

import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Company } from 'src/app/core/models/company.model';
import { CompanyService } from 'src/app/core/services/company.service';
import { TIMEZONES } from 'src/app/core/data/timezones';
import { Timezone } from 'src/app/core/models/timezone.model';

@Component({
  selector: 'app-company-form',
  templateUrl: './company-form.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, MatIconModule, LzAlertComponent, LzButtonDirective, LzFieldComponent, LzFieldDirective, LzPageHeaderComponent, LzPanelComponent]
})
export class CompanyFormComponent implements OnInit {
  companyForm: FormGroup;
  isEditMode = false;
  companyId: string | null = null;
  timezones: Timezone[] = TIMEZONES;
  saving = false;
  loadError = false;
  submitError = '';

  constructor(
    private fb: FormBuilder,
    private companyService: CompanyService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.companyForm = this.fb.group({
      name: ['', Validators.required],
      address: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      website: [''],
      timeZone: ['', Validators.required],
      externalCode: [''],
      currency: [''],
      logoUrl: ['']
    });
  }

  ngOnInit(): void {
    this.companyId = this.route.snapshot.paramMap.get('id');
    if (this.companyId) {
      this.isEditMode = true;
      this.companyService.getCompany(this.companyId).subscribe({
        next: company => this.companyForm.patchValue(company),
        error: () => { this.loadError = true; }
      });
    } else {
      // Pre-select the browser's detected timezone when creating a new company
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (this.timezones.some(tz => tz.value === detected)) {
        this.companyForm.get('timeZone')?.setValue(detected);
      }
    }
  }

  get pageTitle(): string {
    return this.isEditMode
      ? $localize`:@@company_form.title_edit:Edit company`
      : $localize`:@@company_form.title_create:Create company`;
  }

  fieldError(name: string): string | null {
    const control = this.companyForm.get(name);
    if (!control || !control.touched || control.valid) return null;
    if (control.errors?.['email']) return $localize`:@@company_form.email_invalid:Enter a valid email address`;
    return $localize`:@@company_form.field_required:This field is required`;
  }

  onSubmit(): void {
    if (this.companyForm.invalid || this.saving) {
      return;
    }

    const companyData: Company = this.companyForm.value;
    this.saving = true;
    this.submitError = '';

    if (this.isEditMode && this.companyId) {
      this.companyService.updateCompany(this.companyId, companyData).subscribe({
        next: () => {
          this.saving = false;
          this.toastr.success($localize`:@@company_form.toast_updated:Company updated.`);
          this.router.navigate(['/general/manage-companies']);
        },
        error: () => {
          this.saving = false;
          this.submitError = $localize`:@@company_form.update_error:Could not update the company.`;
        }
      });
    } else {
      this.companyService.createCompany(companyData).subscribe({
        next: () => {
          this.saving = false;
          this.toastr.success($localize`:@@company_form.toast_created:Company created.`);
          this.router.navigate(['/general/manage-companies']);
        },
        error: () => {
          this.saving = false;
          this.submitError = $localize`:@@company_form.create_error:Could not create the company.`;
        }
      });
    }
  }
}

