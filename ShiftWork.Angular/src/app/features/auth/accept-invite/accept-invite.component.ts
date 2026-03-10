import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-accept-invite',
  templateUrl: './accept-invite.component.html',
  styleUrls: ['./accept-invite.component.css'],
  standalone: false,
})
export class AcceptInviteComponent implements OnInit {
  inviteForm: FormGroup;
  loading = false;
  success = false;
  invalidLink = false;   // shown in-page instead of redirecting to sign-in
  inviteToken = '';
  companyId = '';
  personId = 0;
  employeeName = '';
  employeeEmail = '';
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.inviteForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.inviteToken    = params['token']     || '';
      this.companyId     = params['companyId']  || '';
      this.personId      = parseInt(params['personId'], 10) || 0;
      // Angular decodes %xx but NOT + (form-encoded space) — replace manually.
      this.employeeName  = (params['name']  || '').replace(/\+/g, ' ');
      this.employeeEmail = (params['email'] || '').replace(/\+/g, ' ');

      if (!this.inviteToken || !this.companyId || !this.personId || !this.employeeEmail) {
        this.invalidLink = true;
      }
    });
  }

  passwordMatchValidator(group: FormGroup) {
    const pw  = group.get('password')?.value;
    const cpw = group.get('confirmPassword')?.value;
    return pw === cpw ? null : { passwordMismatch: true };
  }

  togglePasswordVisibility(field: 'password' | 'confirmPassword'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  acceptInvite(): void {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const password = this.inviteForm.get('password')!.value;

    this.authService.acceptInvite(
      this.inviteToken,
      this.companyId,
      this.personId,
      this.employeeEmail,
      password
    ).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        this.toastr.success('Password set! You can now log in with the mobile app.');
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error(err?.message || 'Failed to set password. The link may have expired.');
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return '??';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
}
