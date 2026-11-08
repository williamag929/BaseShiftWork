import { NAV_SECTIONS, NavSection, procoreSyncLabel, visibleSections } from './nav.config';
import { DASHBOARD_ROUTES } from '../dashboard.module';
import { ProcoreConnection } from 'src/app/core/models/procore-connection.model';

function conn(over: Partial<ProcoreConnection> = {}): ProcoreConnection {
  return {
    companyId: 'c', hasClientSecret: true, baseUrl: '', tokenUrl: '', enabled: true,
    autoPushOnSubmit: false, timesheetSyncEnabled: false, ...over,
  };
}

describe('nav.config', () => {
  it('has five sections in spec order', () => {
    expect(NAV_SECTIONS.map(s => s.id)).toEqual(['scheduling', 'workforce', 'jobSites', 'fieldComms', 'integrations']);
  });

  it('places Time off settings right after Time off in Scheduling', () => {
    const scheduling = NAV_SECTIONS.find(s => s.id === 'scheduling')!.items.map(i => i.id);
    expect(scheduling.indexOf('timeOffSettings')).toBe(scheduling.indexOf('timeOff') + 1);
    const settings = NAV_SECTIONS.flatMap(s => s.items).find(i => i.id === 'timeOffSettings')!;
    expect(settings.route).toBe('/dashboard/people-management');
    expect(NAV_SECTIONS.find(s => s.id === 'workforce')!.items.map(i => i.id)).not.toContain('timeOffSettings');
  });

  it('every item route exists in the dashboard routes or is /kiosk', () => {
    const children = DASHBOARD_ROUTES[0].children!.map(r => r.path);
    NAV_SECTIONS.flatMap(s => s.items.map(i => i.route)).forEach(route => {
      if (route === '/kiosk') { return; }
      const path = route === '/dashboard' ? '' : route.replace('/dashboard/', '');
      expect(children).withContext(route).toContain(path);
    });
  });

  it('hides gated items without permission', () => {
    const ids = visibleSections(NAV_SECTIONS, k => k !== 'active-sites.view').flatMap(s => s.items.map(i => i.id));
    expect(ids).not.toContain('activeSites');
    expect(ids).toContain('locations');
  });

  it('drops a section that ends up empty', () => {
    const only: NavSection[] = [{
      id: 'scheduling', label: 'S', i18nId: 'x',
      items: [{ id: 'a', label: 'A', i18nId: 'y', icon: 'x', route: '/a', permission: 'p' }],
    }];
    expect(visibleSections(only, () => false)).toEqual([]);
  });

  describe('procoreSyncLabel', () => {
    const now = new Date('2026-11-08T12:00:00Z');

    it('returns null when disabled', () => {
      expect(procoreSyncLabel(conn({ enabled: false }), now)).toBeNull();
      expect(procoreSyncLabel(null, now)).toBeNull();
    });

    it('returns danger when last sync failed', () => {
      expect(procoreSyncLabel(conn({ lastSyncStatus: 'Failed' }), now)).toEqual({ tone: 'danger', text: 'Procore sync failed' });
      expect(procoreSyncLabel(conn({ lastSyncStatus: 'ERROR' }), now)?.tone).toBe('danger');
    });

    it('returns minutes ago', () => {
      const at = new Date(now.getTime() - 4 * 60000).toISOString();
      expect(procoreSyncLabel(conn({ lastSyncAt: at }), now)).toEqual({ tone: 'success', text: 'Synced with Procore 4 min ago' });
    });

    it('treats an invalid lastSyncAt as connected', () => {
      expect(procoreSyncLabel(conn({ lastSyncAt: 'not-a-date' }), now)).toEqual({ tone: 'success', text: 'Procore connected' });
    });

    it('returns hours ago and connected fallback', () => {
      const at = new Date(now.getTime() - 3 * 3600000).toISOString();
      expect(procoreSyncLabel(conn({ lastSyncAt: at }), now)?.text).toBe('Synced with Procore 3 h ago');
      expect(procoreSyncLabel(conn(), now)).toEqual({ tone: 'success', text: 'Procore connected' });
    });
  });
});
