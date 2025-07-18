import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html',
  standalone: false,
})
export class VerifyEmailComponent implements OnInit {
  loading = false;

  constructor(public authService: AuthService) { }

  ngOnInit(): void {
  }

  async resendVerificationMail() {
    this.loading = true;
    await this.authService.sendVerificationMail();
    this.loading = false;
  }

}
