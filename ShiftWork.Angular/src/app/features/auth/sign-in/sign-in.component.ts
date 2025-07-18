import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css'],
  standalone: false,
})
export class SignInComponent implements OnInit {
  signInForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    public authService: AuthService
  ) {
    this.signInForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
  }

  async signIn() {
    if (this.signInForm.valid) {
      this.loading = true;
      const { email, password } = this.signInForm.value;
      await this.authService.signIn(email, password);
      this.loading = false;
    }
  }

  async googleSignIn() {
    this.loading = true;
    await this.authService.googleSignIn();
    this.loading = false;
  }
}
