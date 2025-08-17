import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap, catchError, from, of, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { v4 as uuidv4 } from 'uuid';
import { DataService } from './data.service';
import { QueryOptions } from './query-options.service';
import { options } from '@fullcalendar/core/preact';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';

@Injectable({
  providedIn: 'root',
})
export abstract class CoreApiService<T> {
  http = inject(HttpClient);
  dataService = inject(DataService);

  activeCompany$: Observable<any>;
  activeCompany: any;

  url = environment.apiUrl;
  companyId = localStorage.getItem('CompanyId') || '';

  abstract dbPath: string;
  private readonly token: string;
  private httpOptions: any;

  constructor(
        private store: Store<AppState>
  ) {

    this.activeCompany$ = this.store.select(selectActiveCompany);

    this.activeCompany$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
        console.log('Active company set:', this.activeCompany);
      } else {
        console.log('No active company found');
      }
    });

    const user = JSON.parse(localStorage.getItem('user')!);
    this.token = user.stsTokenManager.accessToken;
    this.httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      }),
    };
  }

  create(data: T & { [x: string]: any }): Observable<T> {
    const id = uuidv4();
    (data as any)['createdAt'] = new Date().toISOString();
    (data as any)['id'] = id;
    const endpoint = `${this.url}/companies/${this.activeCompany.companyId}${this.dbPath}`;
    console.log('navigator',navigator.onLine);

    if (navigator.onLine) {
      return this.http.post<T>(endpoint, data).pipe(
        switchMap((response) =>
          this.dataService.postData<T>(this.dbPath, endpoint, response).pipe(map(() => response)),
        ),
        catchError((error) =>
          this.dataService.saveTransaction(this.dbPath, id, data, 'POST', endpoint).pipe(
            map(() => {
              throw error;
            }),
          ),
        ),
      );
    } else {
      return this.dataService.saveTransaction(this.dbPath, id, data, 'POST', endpoint).pipe(
        switchMap((data: T | null) => {
          if (data) {
            return new Observable<T>((subscriber) => {
              subscriber.next(data);
            });
          } else {
            return new Observable<T>((subscriber) => {
              subscriber.error('Error');
            });
          }
        }),
      );
    }
  }

  update(id: string, data: any): Observable<T> {
    (data as any)['editedAt'] = new Date().toISOString();
    const endpoint = `${this.url}/companies/${this.activeCompany.companyId}${this.dbPath}/${id}`;

    if (navigator.onLine) {
      return this.http.put<T>(endpoint, data).pipe(
        switchMap((response) =>
          this.dataService.putData<T>(this.dbPath, endpoint, id, response).pipe(map(() => response)),
        ),
        catchError((error) =>
          this.dataService.saveTransaction(this.dbPath, id, data, 'PUT', endpoint).pipe(
            map(() => {
              throw error;
            }),
          ),
        ),
      );
    } else {
      return this.dataService.saveTransaction(this.dbPath, id, data, 'PUT', endpoint);
    }
  }

  delete(id: string): Observable<T> {
    const endpoint = `${this.url}/companies/${this.activeCompany.companyId}${this.dbPath}/${id}`;

    if (navigator.onLine) {
      return this.http.delete<T>(endpoint).pipe(
        switchMap((response) => this.dataService.deleteData<void>(this.dbPath, endpoint, id).pipe(map(() => response))),
        catchError((error) =>
          this.dataService.saveTransaction(this.dbPath, id, null, 'DELETE', endpoint).pipe(
            map(() => {
              throw error;
            }),
          ),
        ),
      );
    } else {
      return this.dataService.saveTransaction(this.dbPath, id, null, 'DELETE', endpoint).pipe(
        switchMap((data: T | null) => {
          if (data) {
            return new Observable<T>((subscriber) => {
              subscriber.next(data);
            });
          } else {
            return new Observable<T>((subscriber) => {
              subscriber.error('Error');
            });
          }
        }),
      );
    }
  }

  get(id: string): Observable<T | null> {
    const companyId = localStorage.getItem('CompanyId');
    const endpoint = `${this.url}/companies/${companyId}/${this.dbPath}/${id}`;
    const key = `${this.dbPath}_${id}`;

    if (navigator.onLine) {
      return this.http.get<T>(endpoint,{
        headers:{
          Authorization: `Bearer ${this.token}`,
        }
      }).pipe(
        switchMap((response) => this.dataService.setLocalData(this.dbPath, key, response).pipe(map(() => response))),
        catchError((error) =>
          from(this.dataService.getLocalData<T>(this.dbPath, key)).pipe(
            map((localData) => {
              throw error;
            }),
          ),
        ),
      );
    } else {
      return from(this.dataService.getLocalData<T>(this.dbPath, id));
    }
  }

  getAll(queryOptions: string): Observable<T[]> { 
    const companyId = localStorage.getItem('CompanyId');
    const endpoint = `${this.url}/companies/${this.activeCompany.companyId}${this.dbPath}`;
    queryOptions = `queryOptions_${companyId}`;
    console.log('navigator',navigator.onLine);

    const key = this.generateKeyFromQueryOptions(queryOptions);
    if (navigator.onLine) {
      return this.http.get<any[]>(endpoint,
        {
          headers:{
            Authorization: `Bearer ${this.token}`,
          }
        }
      ).pipe(
        switchMap((response) => this.dataService.setLocalData(this.dbPath, key, response).pipe(map(() => response))),
        catchError((error) =>
          //console.log('error',error.toString());
          from(this.dataService.getLocalData<T[]>(this.dbPath, key)).pipe(
            switchMap((localData) => {
              if (localData) {
                return of(localData);
              } else {
                return throwError(() => error);
              }
            }),
          ),
        ),
      );
    } else {
      //return from(this.dataService.getLocalData<T>(this.dbPath, key));
      return from(this.dataService.getLocalData<T[]>(this.dbPath, key)).pipe(
        switchMap((data) => {
          if (data) {
            return of(data);
          } else {
            return throwError(() => new Error('Offline and no local data available'));
          }
        }),
      );      
    }
  }

  getFilterAll(queryOptions: QueryOptions): Observable<T[]> {
    return from(this.getUserId()).pipe(
      switchMap((userId) => {
        let params = new HttpParams();

        if (queryOptions.limit) {
          params = params.set('limit', queryOptions.limit.toString());
        }
        if (queryOptions.orderBy) {
          params = params.set('orderBy', queryOptions.orderBy);
        }
        if (queryOptions.startAt) {
          params = params.set('startAt', queryOptions.startAt);
        }
        if (queryOptions.startAfter) {
          params = params.set('startAfter', queryOptions.startAfter);
        }
        if (queryOptions.endAt) {
          params = params.set('endAt', queryOptions.endAt);
        }
        if (queryOptions.endBefore) {
          params = params.set('endBefore', queryOptions.endBefore);
        }
        if (queryOptions.where) {
          params = params.set('where.field', queryOptions.where.field);
          params = params.set('where.operator', queryOptions.where.operator);
          params = params.set('where.value', String(queryOptions.where.value));
        } else {
          params = params.set('where.field', 'userId');
          params = params.set('where.operator', '==');
          params = params.set('where.value', userId ?? '');
        }

        const key = this.generateKeyFromQueryOptions(queryOptions);
        //const endpoint = this.generateEndpointFromQueryOptions(queryOptions);
        //const companyId = localStorage.getItem('CompanyId');
        const endpoint= `${this.url}/companies/${this.activeCompany.companyId}${this.dbPath}`;

        if (navigator.onLine) {
          return this.http.get<any[]>(endpoint, { params }).pipe(
            switchMap((response) =>
              this.dataService.setLocalData(this.dbPath, key, response).pipe(map(() => response)),
            ),
            catchError((error) =>
              from(this.dataService.getLocalData<T[]>(this.dbPath, key)).pipe(
                switchMap((localData) => {
                  if (localData) {
                    return of(localData);
                  } else {
                    return throwError(() => error);
                  }
                }),
              ),
            ),
          );
        } else {
          return from(this.dataService.getLocalData<T[]>(this.dbPath, key)).pipe(
            switchMap((data) => {
              if (data) {
                return of(data);
              } else {
                return throwError(() => new Error('Offline and no local data available'));
              }
            }),
          );
        }
      }),
    );
  }

  public async getUserId(): Promise<string | null> {
    const user = '1'; //this.auth.currentUser;
    return '1231241';//user?.uid ?? null;
  }

  private generateKeyFromQueryOptions(queryOptions: any): string {
    return JSON.stringify(queryOptions);
  }

  private generateEndpointFromQueryOptions(queryOptions: any): string {
    const params = new URLSearchParams(queryOptions).toString();
    return `${this.url}/companies/${this.activeCompany.companyId}${this.dbPath}`;
  }
}