import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LogService } from '../services/log.service';

@Injectable()
export class HttpErrorLogInterceptor implements HttpInterceptor {
  constructor(private log: LogService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse) {
          this.log.error(`http ${request.method}`, { status: err.status, url: request.url, message: err.message });
        }
        return throwError(() => err);
      })
    );
  }
}
