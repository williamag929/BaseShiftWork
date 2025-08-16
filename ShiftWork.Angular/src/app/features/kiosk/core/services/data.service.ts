import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, lastValueFrom } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import Dexie from 'dexie';
import * as CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root',
})
export class DataService<T> {
  private secretKey = 'CHART-PAPER-SCISSORS-ROCK-PENCIL';
  private db!: Dexie;
  private INSTALLATION_KEY = 'installation_id';

  constructor(private http: HttpClient) {
    this.initializeDatabase();
    window.addEventListener('online', () => this.syncTransactions());
  }

  private initializeDatabase() {
    this.db = new Dexie('MyDatabase');
    this.db.version(1).stores({
      todos: 'key',
      app_meta: 'key',
      transactions: '++id, collection, key, data, timestamp, method, endpoint, payload',
      people: 'key',
      person: 'key',
      locations: 'key',
      areas: 'key',
      tasks: 'key'
    });

    this.checkInstallationId();
  }

  private async checkInstallationId() {
    const installationId = await this.db.table('app_meta').get(this.INSTALLATION_KEY);

    if (!installationId) {
      await this.setInstallationId();
    } else {
      // This means the app has been reinstalled or data was wiped
      await this.wipeAllData();
      await this.setInstallationId();
    }
  }

  private async setInstallationId() {
    const installationId = uuidv4();
    await this.db.table('app_meta').put({ key: this.INSTALLATION_KEY, value: installationId });
  }

  getData<T>(collection: string, key: string, endpoint: string, params?: any): Observable<T | null> {
    return from(this.getLocalData<T>(collection, key)).pipe(
      switchMap((localData) => {
        if (navigator.onLine) {
          return this.fetchFromApiAndStore<T>(collection, key, endpoint, params).pipe(
            catchError(() => of(localData)), // In case of error, return local data
          );
        } else {
          return of(localData);
        }
      }),
    );
  }

  fetchFromApiAndStore<T>(collection: string, key: string, endpoint: string, params?: any): Observable<T> {
    return this.http.get<T>(endpoint, { params }).pipe(
      switchMap((data) => this.setLocalData(collection, key, data).pipe(map(() => data))),
      switchMap((data) => this.saveTransaction(collection, key, data, 'GET', endpoint, params).pipe(map(() => data))), // Save snapshot of the transaction
    );
  }

  postData<T>(collection: string, endpoint: string, data: any): Observable<T> {
    if (navigator.onLine) {
      return this.http
        .post<T>(endpoint, data)
        .pipe(
          switchMap((response) =>
            this.saveTransaction(collection, null, response, 'POST', endpoint, data).pipe(map(() => response)),
          ),
        );
    } else {
      return this.saveTransaction(collection, null, data, 'POST', endpoint);
    }
  }

  putData<T>(collection: string, endpoint: string, key: string, data: any): Observable<T> {
    if (navigator.onLine) {
      return this.http
        .put<T>(endpoint, data)
        .pipe(
          switchMap((response) =>
            this.saveTransaction(collection, key, response, 'PUT', endpoint, data).pipe(map(() => response)),
          ),
        );
    } else {
      return this.saveTransaction(collection, key, data, 'PUT', endpoint);
    }
  }

  deleteData<T>(collection: string, endpoint: string, key: string): Observable<T | null> {
    if (navigator.onLine) {
      return this.http
        .delete<T>(endpoint)
        .pipe(
          switchMap((response) =>
            this.saveTransaction(collection, key, response, 'DELETE', endpoint).pipe(map(() => response)),
          ),
        );
    } else {
      return this.saveTransaction<T>(collection, key, null, 'DELETE', endpoint);
    }
  }

  setLocalData<T>(collection: string, key: string, data: T): Observable<T> {
    const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(data), this.secretKey).toString();
    return from(this.db.table(collection).put({ key, value: encryptedData })).pipe(map(() => data));
  }

  getLocalData<T>(collection: string, key: string): Promise<T | null> {
    return this.db
      .table(collection)
      .get({ key })
      .then((record) => {
        if (record && record.value) {
          const bytes = CryptoJS.AES.decrypt(record.value, this.secretKey);
          const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
          return decryptedData as T;
        }
        return null;
      })
      .catch((error) => {
        console.log('Error getting data from storage', error);
        return null;
      });
  }

  clearData(collection: string, key: string): Observable<void> {
    return from(this.db.table(collection).delete(key));
  }

  clearAllData(collection: string): Observable<void> {
    return from(this.db.table(collection).clear());
  }

  wipeAllData(): Promise<void[]> {
    const collections = [
      'todos',
      'transactions',
      'people',
      'person',
      'locations',
      'areas',
      'tasks'
    ];
    return Promise.all(collections.map((collection) => this.db.table(collection).clear()));
  }

  saveTransaction<T>(
    collection: string,
    key: string | null,
    data: T | null,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    payload?: any,
  ): Observable<T | null> {
    const transaction = {
      collection,
      key,
      data,
      method,
      endpoint,
      payload,
      timestamp: new Date().toISOString(),
    };
    return from(this.db.table('transactions').add(transaction)).pipe(map(() => data));
  }

  async syncTransactions(): Promise<void> {
    const transactions = await this.db.table('transactions').toArray();
    for (const transaction of transactions) {
      try {
        let response;
        if (transaction.method === 'POST') {
          response = await lastValueFrom(this.http.post(transaction.endpoint, transaction.payload));
        } else if (transaction.method === 'PUT') {
          response = await lastValueFrom(this.http.put(transaction.endpoint, transaction.payload));
        } else if (transaction.method === 'DELETE') {
          response = await lastValueFrom(this.http.delete(transaction.endpoint));
        }
        if (response) {
          await this.db.table('transactions').delete(transaction.id); // Remove transaction after successful sync
        }
      } catch (error) {
        console.log('Error syncing transaction', error);
        // If there's an error, keep the transaction for retry
      }
    }
  }

  async saveMultipleData(dataMap: { [key: string]: any[] }): Promise<void> {
    const savePromises: Promise<void>[] = [];

    for (const collection in dataMap) {
      const dataArray = dataMap[collection];
      for (const data of dataArray) {
        const id = data.id || uuidv4();
        savePromises.push(lastValueFrom(this.setLocalData(collection, id, data)).then(() => {}));
      }
    }

    await Promise.all(savePromises);
  }

  async getMultipleData(collectionKeys: string[]): Promise<{ [key: string]: any[] }> {
    const getPromises = collectionKeys.map((collection) =>
      this.db
        .table(collection)
        .toArray()
        .then((records) => ({
          collection,
          records: records.map((record) => {
            const bytes = CryptoJS.AES.decrypt(record.value, this.secretKey);
            return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
          }),
        })),
    );

    const results = await Promise.all(getPromises);
    const dataMap: { [key: string]: any[] } = {};
    for (const result of results) {
      dataMap[result.collection] = result.records;
    }
    return dataMap;
  }
}