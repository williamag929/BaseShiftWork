import { People } from '../models/people.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  getCurrentUser(): Observable<People> {
    return this.http.get<People>(`${this.apiUrl}/auth/user`)
      .pipe(
        catchError(this.handleError)
      );
  }

  verifyPin(personId: number, pin: string): Observable<{ verified: boolean }> {
    const request = { personId, pin };
    return this.http.post<{ verified: boolean }>(`${this.apiUrl}/auth/verify-pin`, request, this.getHttpOptions())
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
      // Server-side errors
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}