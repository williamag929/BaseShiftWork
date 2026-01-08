import { Injectable, NgZone, Injector, runInInjectionContext } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { switchMap, map, catchError, filter, withLatestFrom } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';
import { People } from '../models/people.model';
import { PeopleService } from './people.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user$: Observable<People | null | undefined>;
  activeCompany$: Observable<any>;
  activeCompany: any;
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private router: Router,
    private ngZone: NgZone,
    private toastr: ToastrService,
    private http: HttpClient,
    private peopleService: PeopleService,
    private injector: Injector
  ) {
    this.afAuth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

    this.user$ = this.afAuth.authState.pipe(
      switchMap(user => {
        if (user && user.email) {
          return this.activeCompany$.pipe(
            filter(company => !!company),
            switchMap(company => {
              if (user && user.email) {
                return this.peopleService.getPersonByEmail(company.companyId, user.email);
              } else {
                return of(null);
              }
            })
          );
        } else {
          return of(null);
        }
      })
    );

    this.afAuth.onIdTokenChanged(async user => {
      if (user) {
        const token = await user.getIdToken();
        sessionStorage.setItem('authToken', token);
      } else {
        sessionStorage.removeItem('authToken');
      }
    });

    this.activeCompany$ = this.afs.collection('companies').valueChanges().pipe(
      switchMap((companies: any[]) => {
        return this.afAuth.authState.pipe(
          map(user => {
            if (user) {
              const userCompanies = companies.filter((company: any) => company.users?.includes(user.uid));
              if (userCompanies.length > 0) {
                this.activeCompany = userCompanies[0];
                return this.activeCompany;
              }
            }
            return null;
          })
        );
      })
    );

    this.activeCompany$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
      }
    });
  }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  async SignIn(email: string, password: string) {
    try {
      const credential = await this.afAuth.signInWithEmailAndPassword(email, password);
      if (credential.user) {
        await this.SetUserData(credential.user);
        this.ngZone.run(() => {
          this.toastr.success('Signed in successfully');
          this.router.navigate(['company-switch']);
        });
      }
    } catch (error: any) {
      this.toastr.error(error.message);
    }
  }

  async SetUserData(user: any): Promise<void> {
    try {
      const userRef: AngularFirestoreDocument<any> = runInInjectionContext(this.injector, () =>
        this.afs.doc(`users/${user.uid}`)
      );
      const userData: User = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
      };
      localStorage.setItem('user', JSON.stringify(userData));
      await userRef.set(userData, { merge: true });
    } catch (error) {
      // Capture and rethrow to surface the specific error source
      console.error('SetUserData failed', error);
      throw error;
    }
  }

  async googleSignIn() {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await this.afAuth.signInWithPopup(provider);
      const user = result?.user;
      if (user) {
        await this.SetUserData(user);
        this.ngZone.run(() => {
          this.toastr.success('Google sign-in successful');
          this.router.navigate(['company-switch']);
        });
      } else {
        throw new Error('Google sign-in returned no user. Result credential may be null.');
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  async signOut() {
    await this.afAuth.signOut();
    localStorage.removeItem('user');
    sessionStorage.removeItem('authToken');
    this.toastr.success('Signed out successfully');
    return this.router.navigate(['/']);
  }

  async updateUserData(user: any) {
    const userRef: AngularFirestoreDocument<any> = runInInjectionContext(this.injector, () =>
      this.afs.doc(`users/${user?.uid}`)
    );
    const data: User = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      emailVerified: user.emailVerified || false
    };
    return userRef.set(data, { merge: true });
  }

  async signUp(email: string, password: string): Promise<void> {
    try {
      const credential = await this.afAuth.createUserWithEmailAndPassword(email, password);
      if (credential.user) {
        await this.sendVerificationMail();
        this.toastr.success('Signed up successfully');
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  async sendVerificationMail(): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        await user.sendEmailVerification();
        this.toastr.success('Verification email sent');
        this.router.navigate(['/verify-email']);
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  verifyPin(personId: number, pin: string): Observable<{ verified: boolean }> {
    const request = { personId, pin };
    return this.http.post<{ verified: boolean }>(`${this.apiUrl}/auth/verify-pin`, request, this.getHttpOptions())
      .pipe(
        catchError((err) => this.handleHttpError(err))
      );
  }

  async forgotPassword(passwordResetEmail: string): Promise<void> {
    try {
      await this.afAuth.sendPasswordResetEmail(passwordResetEmail);
      this.toastr.success('Password reset email sent');
    } catch (error: any) {
      this.handleError(error);
    }
  }

  isEmailVerified(): Observable<boolean> {
    return this.user$.pipe(
      map(user => !!user)
    );
  }

  private handleError(error: any): void {
    console.error('Error occurred:', error);
    this.toastr.error(error.message || 'An error occurred');
  }

  private handleHttpError(error: HttpErrorResponse) {
    let errorMessage = 'Unknown error!';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  async getToken(): Promise<string | null> {
    const user = await this.afAuth.currentUser;
    if (user) {
      return user.getIdToken().then(token => {
        sessionStorage.setItem('authToken', token);
        return token;
      });
    } else {
      return this.getTokenFromSessionStorage();
    }
  }

  getTokenFromSessionStorage(): string | null {
    return sessionStorage.getItem('authToken');
  }

  get isLoggedIn(): boolean {
    const user = JSON.parse(localStorage.getItem('user')!);
    return user !== null && user.emailVerified !== false ? true : false;
  }
}