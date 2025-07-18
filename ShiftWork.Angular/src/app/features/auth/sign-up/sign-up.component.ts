import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sign-up',
  templateUrl: './sign-up.component.html',
  standalone: false,
})
export class SignUpComponent implements OnInit {
  signUpForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    public authService: AuthService
  ) {
    this.signUpForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
  }

  async signUp() {
    if (this.signUpForm.valid) {
      this.loading = true;
      const { email, password } = this.signUpForm.value;
      await this.authService.signUp(email, password);
      this.loading = false;
    }
  }

  async googleSignIn() {
    this.loading = true;
    await this.authService.googleSignIn();
    this.loading = false;
  }
}
