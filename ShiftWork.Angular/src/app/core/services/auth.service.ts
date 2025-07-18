import { Injectable, NgZone } from '@angular/core';
import { User } from '../models/user.model';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { Observable, of, map } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user$: Observable<User | null | undefined>;
  activeCompany$: any;
  activeCompany: any;
  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private router: Router,
    private ngZone: NgZone,
    private toastr: ToastrService
  ) {

    this.afAuth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

    this.user$ = this.afAuth.authState.pipe(
      switchMap(user => {
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
          return this.afs.doc<User>(`users/${user.uid}`).valueChanges().
            pipe(map(u => u ? { ...u, emailVerified: user.emailVerified } : null));
        } else {
          return of(null);
        }
      })
    );

    // Listen for auth state changes to save/remove the token
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

    this.activeCompany$.subscribe((company:any) => {
      if (company) {
        this.activeCompany = company;
        console.log('Active company set:', this.activeCompany);
      } else {
        console.log('No active company found');
      }
    });
  }


  async SignIn(email: string, password: string) {
    try {
      const result = await this.afAuth.signInWithEmailAndPassword(email, password);
      //this.SetUserData(result.user);
      this.afAuth.authState.subscribe((user) => {
        if (user) {
          this.router.navigate(['company-switch']);
          //this.peopleService.GetbyEmail(email).subscribe(
          //  (data:any) => {
          //    console.log('person',data);
          //    this.router.navigate(['dashboard']);
          //  })
        }
      });
    } catch (error: any) {
      window.alert(error.message);
    }
  }
  SetUserData(user: any) {
    const userRef: AngularFirestoreDocument<any> = this.afs.doc(
      `users/${user.uid}`
    );
    const userData: User = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
    };
    return userRef.set(userData, {
      merge: true,
    });
  }

  async googleSignIn() {
    try {
      const credential = await this.afAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      if (credential.user) {
        this.ngZone.run(() => {
          this.toastr.success('Google sign-in successful');
          this.router.navigate(['company-switch']);
          //this.router.navigate(['/dashboard']);
        });
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.toastr.clear();
    }

  }

  async signOut() {
    await this.afAuth.signOut();
    this.toastr.success('Signed out successfully');
    return this.router.navigate(['/']);
  }

  async updateUserData(user: any) {

    const userRef: AngularFirestoreDocument<any> = this.afs.doc(`users/${user?.uid}`);
    const data: User = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      emailVerified: user.emailVerified || false
    };
    console.log('Updating user data:', data);
    return userRef.set(data, { merge: true });
  }

  async signIn(email: string, password: string): Promise<void> {
    try {
      const credential = await (await this.afAuth.signInWithEmailAndPassword(email, password));
      if (credential.user) {
        console.log('User signed in:', credential);
        localStorage.setItem('user', JSON.stringify(credential.user));
        this.ngZone.run(() => {
          this.toastr.success('Signed in successfully');
          this.router.navigate(['company-switch']);
          //this.router.navigate(['/dashboard']);
        });
      }
    } catch (error) {
      this.handleError(error);
    }
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
      switchMap(user => of(!!user && user.emailVerified === true))
    );
  }

  private handleError(error: any): void {
    console.error('Error occurred:', error);
    this.toastr.error(error.message || 'An error occurred');
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

  async getTokenSilently(): Promise<string | null> {
    const user = await this.afAuth.currentUser;
    if (user) {
      return user.getIdToken(true);
    } else {
      return null;
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
