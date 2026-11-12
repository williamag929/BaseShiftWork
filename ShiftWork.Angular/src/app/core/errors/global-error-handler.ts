import { ErrorHandler, Injectable } from '@angular/core';
import { LogService } from '../services/log.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private log: LogService) {}

  handleError(error: unknown): void {
    this.log.error('unhandled', error);
  }
}
