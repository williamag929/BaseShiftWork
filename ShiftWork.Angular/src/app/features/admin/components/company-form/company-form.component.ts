import { Component, OnInit } from '@angular/core';
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
  styleUrls: ['./company-form.component.css'],
  standalone: false
})
export class CompanyFormComponent implements OnInit {
  companyForm: FormGroup;
  isEditMode = false;
  companyId: string | null = null;
  timezones: Timezone[] = TIMEZONES;

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
      this.companyService.getCompany(this.companyId).subscribe(company => {
        this.companyForm.patchValue(company);
      });
    } else {
      // Pre-select the browser's detected timezone when creating a new company
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (this.timezones.some(tz => tz.value === detected)) {
        this.companyForm.get('timeZone')?.setValue(detected);
      }
    }
  }

  onSubmit(): void {
    if (this.companyForm.invalid) {
      return;
    }

    const companyData: Company = this.companyForm.value;

    if (this.isEditMode && this.companyId) {
      this.companyService.updateCompany(this.companyId, companyData).subscribe(() => {
        this.toastr.success('Company updated successfully');
        this.router.navigate(['/general/manage-companies']);
      });
    } else {
      this.companyService.createCompany(companyData).subscribe(() => {
        this.toastr.success('Company created successfully');
        this.router.navigate(['/general/manage-companies']);
      });
    }
  }
}

