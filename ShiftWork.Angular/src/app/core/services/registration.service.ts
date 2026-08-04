import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface CompanyRegistrationRequest {
  firebaseUid: string;
  userEmail: string;
  userDisplayName: string;
  companyName: string;
  companyEmail: string;
  companyPhone?: string;
  timeZone: string;
}

export interface CompanyRegistrationResponse {
  companyId: string;
  plan: string;
  onboardingStatus: string;
  adminUser: any;
}

@Injectable({
  providedIn: 'root'
})
export class RegistrationService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private afAuth: AngularFireAuth
  ) {}

  /**
   * Registers a new company. Caller must already have a Firebase user created.
   * This method gets the Firebase ID token and sends it with the company info to the backend.
   */
  async registerCompany(data: Omit<CompanyRegistrationRequest, 'firebaseUid'>): Promise<CompanyRegistrationResponse> {
    const currentUser = await this.afAuth.currentUser;
    if (!currentUser) {
      throw new Error('No Firebase user found. Please sign up first.');
    }

    const idToken = await currentUser.getIdToken();
    const firebaseUid = currentUser.uid;

    const request: CompanyRegistrationRequest = {
      firebaseUid,
      ...data
    };

    return new Promise((resolve, reject) => {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      };

      this.http.post<CompanyRegistrationResponse>(
        `${this.apiUrl}/auth/register`,
        request,
        { headers }
      ).subscribe({
        next: (response) => resolve(response),
        error: (error) => reject(error)
      });
    });
  }
}
