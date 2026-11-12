import { TestBed } from '@angular/core/testing';
import { LogService } from './log.service';

describe('LogService', () => {
  let service: LogService;

  beforeEach(() => {
    localStorage.removeItem('loqzen.log');
    spyOn(console, 'error');
    spyOn(console, 'warn');
    service = TestBed.inject(LogService);
  });

  it('keeps the Firebase code and message of a login failure', () => {
    service.error('sign-in', { code: 'auth/invalid-credential', message: 'bad credentials' });
    const [entry] = service.entries();
    expect(entry.source).toBe('sign-in');
    expect(entry.code).toBe('auth/invalid-credential');
    expect(entry.message).toBe('bad credentials');
  });

  it('drops the query string and never stores bodies or headers', () => {
    service.error('http POST', { status: 401, url: 'http://x/api/auth?token=secret', message: 'x', error: { password: 'p' } });
    const [entry] = service.entries();
    expect(entry.url).toBe('http://x/api/auth');
    expect(JSON.stringify(entry)).not.toContain('secret');
    expect(JSON.stringify(entry)).not.toContain('"p"');
  });

  it('keeps only the latest 100 entries', () => {
    for (let i = 0; i < 105; i++) service.warn('t', new Error(`e${i}`));
    const entries = service.entries();
    expect(entries.length).toBe(100);
    expect(entries[99].message).toBe('e104');
  });

  it('clear empties the log', () => {
    service.error('t', new Error('x'));
    service.clear();
    expect(service.entries()).toEqual([]);
  });
});
