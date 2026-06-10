import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { UserClaims } from '../models/user-claims.model';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private readonly apiUrl = environment.apiUrl;
  private permissionsSubject = new BehaviorSubject<UserClaims | null>(null);
  private cachedVersion = 0;

  public permissions$ = this.permissionsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Load user claims from the API endpoint /me/claims
   * Caches the result and uses permissionsVersion for invalidation
   */
  loadUserClaims(companyId: string): Observable<UserClaims> {
    return this.http.get<UserClaims>(
      `${this.apiUrl}/companies/${companyId}/users/me/claims`
    ).pipe(
      tap(claims => {
        this.permissionsSubject.next(claims);
        this.cachedVersion = claims.permissionsVersion;
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Refresh claims if the version has changed (invalidation check)
   */
  refreshClaimsIfNeeded(companyId: string): Observable<UserClaims | null> {
    const current = this.permissionsSubject.value;
    if (!current) {
      return this.loadUserClaims(companyId);
    }
    // In a real scenario, you might check if the version changed by polling or via WebSocket
    // For now, return the current cached claims
    return of(current);
  }

  /**
   * Get cached user claims synchronously
   */
  getCachedClaims(): UserClaims | null {
    return this.permissionsSubject.value;
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: string): boolean {
    const claims = this.permissionsSubject.value;
    return claims ? claims.permissions.includes(permission) : false;
  }

  /**
   * Check if user has all permissions in the list
   */
  hasAllPermissions(permissions: string[]): boolean {
    const claims = this.permissionsSubject.value;
    if (!claims) return false;
    return permissions.every(p => claims.permissions.includes(p));
  }

  /**
   * Check if user has any permission in the list
   */
  hasAnyPermission(permissions: string[]): boolean {
    const claims = this.permissionsSubject.value;
    if (!claims) return false;
    return permissions.some(p => claims.permissions.includes(p));
  }

  /**
   * Get observable of users permissions
   */
  getPermissions(): Observable<string[]> {
    return this.permissions$.pipe(
      map(claims => claims ? claims.permissions : [])
    );
  }

  /**
   * Get observable of user roles
   */
  getRoles(): Observable<string[]> {
    return this.permissions$.pipe(
      map(claims => claims ? claims.roles : [])
    );
  }

  /**
   * Clear cached claims (e.g., on logout)
   */
  clearClaims(): void {
    this.permissionsSubject.next(null);
    this.cachedVersion = 0;
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Failed to load user claims';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
