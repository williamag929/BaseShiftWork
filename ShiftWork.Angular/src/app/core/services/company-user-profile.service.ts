import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CompanyUserProfile, AssignRoleRequest, AssignRoleToPersonRequest } from '../models/company-user-profile.model';

@Injectable({
  providedIn: 'root'
})
export class CompanyUserProfileService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  /**
   * Get all profiles (role assignments) for a specific user in a company
   */
  getUserProfiles(companyId: string, companyUserId: string): Observable<CompanyUserProfile[]> {
    return this.http.get<CompanyUserProfile[]>(
      `${this.apiUrl}/companies/${companyId}/companyuserprofiles/user/${companyUserId}`
    ).pipe(catchError(this.handleError));
  }

  /**
   * Get all users assigned to a specific role
   */
  getRoleProfiles(companyId: string, roleId: number): Observable<CompanyUserProfile[]> {
    return this.http.get<CompanyUserProfile[]>(
      `${this.apiUrl}/companies/${companyId}/companyuserprofiles/role/${roleId}`
    ).pipe(catchError(this.handleError));
  }

  /**
   * Get all roles assigned to a specific person
   */
  getPersonProfiles(companyId: string, personId: number): Observable<CompanyUserProfile[]> {
    return this.http.get<CompanyUserProfile[]>(
      `${this.apiUrl}/companies/${companyId}/companyuserprofiles/person/${personId}`
    ).pipe(catchError(this.handleError));
  }

  /**
   * Get a specific profile by ID
   */
  getProfile(companyId: string, profileId: number): Observable<CompanyUserProfile> {
    return this.http.get<CompanyUserProfile>(
      `${this.apiUrl}/companies/${companyId}/companyuserprofiles/${profileId}`
    ).pipe(catchError(this.handleError));
  }

  /**
   * Assign a role to a user
   */
  assignRole(companyId: string, request: AssignRoleRequest): Observable<CompanyUserProfile> {
    return this.http.post<CompanyUserProfile>(
      `${this.apiUrl}/companies/${companyId}/companyuserprofiles/assign`,
      request,
      this.getHttpOptions()
    ).pipe(catchError(this.handleError));
  }

  /**
   * Assign a role to a person (convenience method)
   */
  assignRoleToPerson(companyId: string, request: AssignRoleToPersonRequest): Observable<CompanyUserProfile> {
    return this.http.post<CompanyUserProfile>(
      `${this.apiUrl}/companies/${companyId}/companyuserprofiles/assign-to-person`,
      request,
      this.getHttpOptions()
    ).pipe(catchError(this.handleError));
  }

  /**
   * Remove a role assignment (deactivate profile)
   */
  removeRoleAssignment(companyId: string, profileId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/companies/${companyId}/companyuserprofiles/${profileId}`
    ).pipe(catchError(this.handleError));
  }

  /**
   * Remove all role assignments for a user
   */
  removeAllUserRoles(companyId: string, companyUserId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/companies/${companyId}/companyuserprofiles/user/${companyUserId}`
    ).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
