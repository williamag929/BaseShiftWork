import * as SQLite from 'expo-sqlite';
import type { SQLTransaction, SQLResultSet } from 'expo-sqlite';
import type { ShiftEventDto, ScheduleShiftDto } from '@/types/api';

const db = SQLite.openDatabase('shiftwork.db');

export const initDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    db.transaction(
  (tx: SQLTransaction) => {
        tx.executeSql(`CREATE TABLE IF NOT EXISTS shift_events (
          eventLogId TEXT PRIMARY KEY NOT NULL,
          eventDate TEXT,
          eventType TEXT,
          companyId TEXT,
          personId INTEGER,
          description TEXT,
          kioskDevice TEXT,
          geoLocation TEXT,
          photoUrl TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );`);

        tx.executeSql(`CREATE TABLE IF NOT EXISTS schedule_shifts (
          scheduleShiftId INTEGER PRIMARY KEY NOT NULL,
          scheduleId INTEGER,
          companyId TEXT,
          personId INTEGER,
          locationId INTEGER,
          areaId INTEGER,
          startDate TEXT,
          endDate TEXT,
          status TEXT,
          updatedAt TEXT
        );`);
      },
  (err: any) => reject(err),
      () => resolve()
    );
  });

export const upsertShiftEvents = (events: ShiftEventDto[]): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!events?.length) return resolve();
    db.transaction(
  (tx: SQLTransaction) => {
        for (const e of events) {
          tx.executeSql(
            `INSERT OR REPLACE INTO shift_events (
              eventLogId, eventDate, eventType, companyId, personId, description, kioskDevice, geoLocation, photoUrl, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              e.eventLogId,
              new Date(e.eventDate).toISOString(),
              e.eventType,
              e.companyId,
              e.personId,
              e.description || null,
              e.kioskDevice || null,
              e.geoLocation || null,
              e.photoUrl || null,
              e.createdAt ? new Date(e.createdAt).toISOString() : null,
              e.updatedAt ? new Date(e.updatedAt).toISOString() : null,
            ]
          );
        }
      },
  (err: any) => reject(err),
      () => resolve()
    );
  });

export const upsertScheduleShifts = (shifts: ScheduleShiftDto[]): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!shifts?.length) return resolve();
    db.transaction(
  (tx: SQLTransaction) => {
        for (const s of shifts) {
          tx.executeSql(
            `INSERT OR REPLACE INTO schedule_shifts (
              scheduleShiftId, scheduleId, companyId, personId, locationId, areaId, startDate, endDate, status, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              s.scheduleShiftId,
              s.scheduleId,
              s.companyId,
              s.personId,
              s.locationId,
              s.areaId,
              new Date(s.startDate).toISOString(),
              new Date(s.endDate).toISOString(),
              s.status,
              s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
            ]
          );
        }
      },
  (err: any) => reject(err),
      () => resolve()
    );
  });

export const getRecentEvents = (
  personId: number,
  limit = 10
): Promise<ShiftEventDto[]> =>
  new Promise((resolve, reject) => {
    db.readTransaction(
      (tx: SQLTransaction) => {
        tx.executeSql(
          `SELECT * FROM shift_events WHERE personId = ? ORDER BY datetime(eventDate) DESC LIMIT ?;`,
          [personId, limit],
          (_: SQLTransaction, res: SQLResultSet) => {
            const items: ShiftEventDto[] = [] as any;
            for (let i = 0; i < res.rows.length; i++) items.push(res.rows.item(i));
            resolve(items);
          }
        );
      },
      (err: any) => reject(err)
    );
  });

export const getUpcomingShifts = (
  personId: number,
  fromISO: string,
  toISO: string
): Promise<ScheduleShiftDto[]> =>
  new Promise((resolve, reject) => {
    db.readTransaction(
      (tx: SQLTransaction) => {
        tx.executeSql(
          `SELECT * FROM schedule_shifts 
           WHERE personId = ? AND datetime(startDate) >= datetime(?) AND datetime(startDate) < datetime(?)
           ORDER BY datetime(startDate) ASC;`,
          [personId, fromISO, toISO],
          (_: SQLTransaction, res: SQLResultSet) => {
            const items: ScheduleShiftDto[] = [] as any;
            for (let i = 0; i < res.rows.length; i++) items.push(res.rows.item(i));
            resolve(items);
          }
        );
      },
      (err: any) => reject(err)
    );
  });

export const getEventsInRange = (
  personId: number,
  fromISO: string,
  toISO: string
): Promise<ShiftEventDto[]> =>
  new Promise((resolve, reject) => {
    db.readTransaction(
      (tx: SQLTransaction) => {
        tx.executeSql(
          `SELECT * FROM shift_events 
           WHERE personId = ? AND datetime(eventDate) >= datetime(?) AND datetime(eventDate) <= datetime(?)
           ORDER BY datetime(eventDate) ASC;`,
          [personId, fromISO, toISO],
          (_: SQLTransaction, res: SQLResultSet) => {
            const items: ShiftEventDto[] = [] as any;
            for (let i = 0; i < res.rows.length; i++) items.push(res.rows.item(i));
            resolve(items);
          }
        );
      },
      (err: any) => reject(err)
    );
  });

export const dbService = {
  initDb,
  upsertShiftEvents,
  upsertScheduleShifts,
  getRecentEvents,
  getUpcomingShifts,
  getEventsInRange,
};
