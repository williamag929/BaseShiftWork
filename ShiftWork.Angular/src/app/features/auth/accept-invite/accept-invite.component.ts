import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { InviteService } from '../../../core/services/invite.service';
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
  inviteToken = '';
  companyId = 0;
  personId = 0;
  employeeName = '';
  employeeEmail = '';
  companyName = '';
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private afAuth: AngularFireAuth,
    private inviteService: InviteService,
    private toastr: ToastrService
  ) {
    this.inviteForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    // Parse query parameters
    this.route.queryParams.subscribe(params => {
      this.inviteToken = params['token'] || '';
      this.companyId = parseInt(params['companyId']) || 0;
      this.personId = parseInt(params['personId']) || 0;
      this.employeeName = params['name'] || '';
      this.employeeEmail = params['email'] || '';
      this.companyName = params['company'] || '';

      if (!this.inviteToken || !this.companyId || !this.personId || !this.employeeEmail) {
        this.toastr.error('Invalid invite link');
        this.router.navigate(['/sign-in']);
      }
    });
  }

  passwordMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  togglePasswordVisibility(field: 'password' | 'confirmPassword'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  async acceptInvite() {
    if (this.inviteForm.invalid) {
      this.toastr.error('Please fill in all fields correctly');
      return;
    }

    this.loading = true;

    try {
      const password = this.inviteForm.get('password')?.value;

      // Step 1: Create Firebase account
      const userCredential = await this.afAuth.createUserWithEmailAndPassword(this.employeeEmail, password);
      
      if (!userCredential || !userCredential.user) {
        throw new Error('Failed to create account');
      }

      // Step 2: Get Firebase ID token
      const firebaseToken = await userCredential.user.getIdToken();

      // Step 3: Complete invite on backend
      this.inviteService.completeInvite(this.companyId.toString(), {
        inviteToken: this.inviteToken,
        personId: this.personId
      }, firebaseToken).subscribe(
        () => {
          this.toastr.success('Account created successfully! Please sign in.');
          this.router.navigate(['/sign-in']);
        },
        error => {
          console.error('Error completing invite:', error);
          this.toastr.error('Failed to complete account setup. Please contact support.');
          this.loading = false;
        }
      );
    } catch (error: any) {
      console.error('Error creating Firebase account:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        this.toastr.error('An account with this email already exists. Please sign in.');
        this.router.navigate(['/sign-in']);
      } else {
        this.toastr.error('Failed to create account. Please try again.');
      }
      
      this.loading = false;
    }
  }

  getInitials(name: string): string {
    if (!name) return '??';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
