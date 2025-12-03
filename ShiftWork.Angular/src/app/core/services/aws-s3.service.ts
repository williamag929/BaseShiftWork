import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AwsS3Service {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  uploadFile(bucketName: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<any>(`${this.apiUrl}/s3/file/${bucketName}`, formData)
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Unknown error!';
    if (error.error instanceof ErrorEvent) {
      // Client-side errors
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side errors; prefer server-provided body text when available
      const serverBody = typeof error.error === 'string' ? error.error : (error.error?.message || '');
      errorMessage = `Error Code: ${error.status}\nMessage: ${serverBody || error.message}`;
    }
    console.error(error);
    return throwError(() => new Error(errorMessage));
  }
}