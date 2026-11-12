import { Injectable } from '@angular/core';

export type LogLevel = 'error' | 'warn';

export interface LogEntry {
  at: string;
  level: LogLevel;
  source: string;
  message: string;
  code?: string;
  status?: number;
  url?: string;
  route: string;
}

const STORAGE_KEY = 'loqzen.log';
const MAX_ENTRIES = 100;

@Injectable({ providedIn: 'root' })
export class LogService {
  error(source: string, error: unknown): void {
    this.write('error', source, error);
  }

  warn(source: string, error: unknown): void {
    this.write('warn', source, error);
  }

  entries(): LogEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as LogEntry[]) : [];
    } catch {
      return [];
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable (private mode or quota); nothing to clear
    }
  }

  private write(level: LogLevel, source: string, error: unknown): void {
    const entry = this.toEntry(level, source, error);
    console[level](`[loqzen:${source}]`, entry.code ?? entry.status ?? '', entry.message);
    try {
      const entries = [...this.entries(), entry].slice(-MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // storage unavailable (private mode or quota); the console line above still exists
    }
  }

  // Only code, message, status and the URL path are kept: request/response bodies and
  // headers can carry passwords and tokens.
  private toEntry(level: LogLevel, source: string, error: unknown): LogEntry {
    const e = (error ?? {}) as { code?: unknown; message?: unknown; status?: unknown; url?: unknown };
    return {
      at: new Date().toISOString(),
      level,
      source,
      message: typeof e.message === 'string' ? e.message : String(error),
      code: typeof e.code === 'string' ? e.code : undefined,
      status: typeof e.status === 'number' ? e.status : undefined,
      url: typeof e.url === 'string' ? e.url.split('?')[0] : undefined,
      route: location.pathname,
    };
  }
}
