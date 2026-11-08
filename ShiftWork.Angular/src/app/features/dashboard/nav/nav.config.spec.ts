import { NAV_SECTIONS, NavSection, procoreSyncLabel, visibleSections } from './nav.config';
import { ProcoreConnection } from 'src/app/core/models/procore-connection.model';

const KNOWN_ROUTES = [
  '/dashboard', '/dashboard/schedule-grid', '/dashboard/shiftsummaries', '/dashboard/time-off-approvals',
  '/dashboard/people', '/dashboard/crews', '/dashboard/credentials', '/dashboard/people-management',
  '/dashboard/locations', '/dashboard/areas', '/dashboard/cost-codes', '/dashboard/tasks',
  '/dashboard/active-sites', '/dashboard/daily-reports', '/dashboard/bulletins', '/dashboard/safety',
  '/dashboard/documents', '/dashboard/procore', '/kiosk',
];

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

  it('every item route exists in the dashboard routes or is /kiosk', () => {
    const routes = NAV_SECTIONS.flatMap(s => s.items.map(i => i.route));
    expect(routes.length).toBe(KNOWN_ROUTES.length);
    routes.forEach(r => expect(KNOWN_ROUTES).toContain(r));
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

    it('returns hours ago and connected fallback', () => {
      const at = new Date(now.getTime() - 3 * 3600000).toISOString();
      expect(procoreSyncLabel(conn({ lastSyncAt: at }), now)?.text).toBe('Synced with Procore 3 h ago');
      expect(procoreSyncLabel(conn(), now)).toEqual({ tone: 'success', text: 'Procore connected' });
    });
  });
});
