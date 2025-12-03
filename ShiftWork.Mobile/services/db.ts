import * as SQLite from 'expo-sqlite';
import type { ShiftEventDto, ScheduleShiftDto } from '@/types/api';

let db: SQLite.SQLiteDatabase | null = null;

const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('shiftwork.db');
  }
  return db;
};

export const initDb = async (): Promise<void> => {
  const database = await getDb();
  
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS shift_events (
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
    );
    
    CREATE TABLE IF NOT EXISTS schedule_shifts (
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
    );
  `);
};

export const upsertShiftEvents = async (events: ShiftEventDto[]): Promise<void> => {
  if (!events?.length) return;
  const database = await getDb();
  
  for (const e of events) {
    await database.runAsync(
      `INSERT OR REPLACE INTO shift_events (
        eventLogId, eventDate, eventType, companyId, personId, description, kioskDevice, geoLocation, photoUrl, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
};

export const upsertScheduleShifts = async (shifts: ScheduleShiftDto[]): Promise<void> => {
  if (!shifts?.length) return;
  const database = await getDb();
  
  for (const s of shifts) {
    await database.runAsync(
      `INSERT OR REPLACE INTO schedule_shifts (
        scheduleShiftId, scheduleId, companyId, personId, locationId, areaId, startDate, endDate, status, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
};

export const getRecentEvents = async (
  personId: number,
  limit = 10
): Promise<ShiftEventDto[]> => {
  const database = await getDb();
  const result = await database.getAllAsync<ShiftEventDto>(
    `SELECT * FROM shift_events WHERE personId = ? ORDER BY datetime(eventDate) DESC LIMIT ?`,
    [personId, limit]
  );
  return result;
};

export const getUpcomingShifts = async (
  personId: number,
  fromISO: string,
  toISO: string
): Promise<ScheduleShiftDto[]> => {
  const database = await getDb();
  const result = await database.getAllAsync<ScheduleShiftDto>(
    `SELECT * FROM schedule_shifts 
     WHERE personId = ? AND datetime(startDate) >= datetime(?) AND datetime(startDate) < datetime(?)
     ORDER BY datetime(startDate) ASC`,
    [personId, fromISO, toISO]
  );
  return result;
};

export const getEventsInRange = async (
  personId: number,
  fromISO: string,
  toISO: string
): Promise<ShiftEventDto[]> => {
  const database = await getDb();
  const result = await database.getAllAsync<ShiftEventDto>(
    `SELECT * FROM shift_events 
     WHERE personId = ? AND datetime(eventDate) >= datetime(?) AND datetime(eventDate) <= datetime(?)
     ORDER BY datetime(eventDate) ASC`,
    [personId, fromISO, toISO]
  );
  return result;
};

export const dbService = {
  initDb,
  upsertShiftEvents,
  upsertScheduleShifts,
  getRecentEvents,
  getUpcomingShifts,
  getEventsInRange,
};
