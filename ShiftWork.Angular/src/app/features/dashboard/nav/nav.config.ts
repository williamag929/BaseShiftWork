import { ProcoreConnection } from 'src/app/core/models/procore-connection.model';

export interface NavItem {
  id: string;
  label: string;
  i18nId: string;
  icon: string;
  route: string;
  exact?: boolean;
  permission?: string;
  badge?: 'pendingTimeOff';
  tourId?: string;
}

export interface NavSection {
  id: 'scheduling' | 'workforce' | 'jobSites' | 'fieldComms' | 'integrations';
  label: string;
  i18nId: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'scheduling',
    label: $localize`:@@nav.section.scheduling:Scheduling`,
    i18nId: 'nav.section.scheduling',
    items: [
      { id: 'overview', label: $localize`:@@nav.item.overview:Overview`, i18nId: 'nav.item.overview', icon: 'space_dashboard', route: '/dashboard', exact: true },
      { id: 'schedule', label: $localize`:@@nav.item.schedule:Schedule`, i18nId: 'nav.item.schedule', icon: 'calendar_view_week', route: '/dashboard/schedule-grid', tourId: 'tour-nav-schedule' },
      { id: 'timesheets', label: $localize`:@@nav.item.timesheets:Timesheets`, i18nId: 'nav.item.timesheets', icon: 'assignment', route: '/dashboard/shiftsummaries' },
      { id: 'analytics', label: $localize`:@@nav.item.analytics:Analytics`, i18nId: 'nav.item.analytics', icon: 'insights', route: '/dashboard/analytics', permission: 'analytics.view' },
      { id: 'timeOff', label: $localize`:@@nav.item.time_off:Time off`, i18nId: 'nav.item.time_off', icon: 'event_busy', route: '/dashboard/time-off-approvals' },
    ],
  },
  {
    id: 'workforce',
    label: $localize`:@@nav.section.workforce:Workforce`,
    i18nId: 'nav.section.workforce',
    items: [
      { id: 'people', label: $localize`:@@nav.item.people:People`, i18nId: 'nav.item.people', icon: 'people', route: '/dashboard/people', tourId: 'tour-nav-people' },
      { id: 'crews', label: $localize`:@@nav.item.crews:Crews`, i18nId: 'nav.item.crews', icon: 'group_work', route: '/dashboard/crews' },
      { id: 'credentials', label: $localize`:@@nav.item.credentials:Credentials`, i18nId: 'nav.item.credentials', icon: 'badge', route: '/dashboard/credentials', permission: 'credentials.read' },
      { id: 'rolesAccess', label: $localize`:@@nav.item.roles_access:Roles & access`, i18nId: 'nav.item.roles_access', icon: 'admin_panel_settings', route: '/dashboard/people-management' },
    ],
  },
  {
    id: 'jobSites',
    label: $localize`:@@nav.section.job_sites:Job sites`,
    i18nId: 'nav.section.job_sites',
    items: [
      { id: 'locations', label: $localize`:@@nav.item.locations:Locations`, i18nId: 'nav.item.locations', icon: 'location_on', route: '/dashboard/locations', tourId: 'tour-nav-locations' },
      { id: 'areas', label: $localize`:@@nav.item.areas:Areas`, i18nId: 'nav.item.areas', icon: 'place', route: '/dashboard/areas' },
      { id: 'costCodes', label: $localize`:@@nav.item.cost_codes:Cost codes`, i18nId: 'nav.item.cost_codes', icon: 'tag', route: '/dashboard/cost-codes' },
      { id: 'tasks', label: $localize`:@@nav.item.tasks:Tasks`, i18nId: 'nav.item.tasks', icon: 'check_box', route: '/dashboard/tasks' },
      { id: 'activeSites', label: $localize`:@@nav.item.active_sites:Active sites`, i18nId: 'nav.item.active_sites', icon: 'travel_explore', route: '/dashboard/active-sites', permission: 'active-sites.view' },
      { id: 'dailyReports', label: $localize`:@@nav.item.daily_reports:Daily reports`, i18nId: 'nav.item.daily_reports', icon: 'today', route: '/dashboard/daily-reports' },
    ],
  },
  {
    id: 'fieldComms',
    label: $localize`:@@nav.section.field_comms:Field communication`,
    i18nId: 'nav.section.field_comms',
    items: [
      { id: 'bulletins', label: $localize`:@@nav.item.bulletins:Bulletins`, i18nId: 'nav.item.bulletins', icon: 'campaign', route: '/dashboard/bulletins' },
      { id: 'safety', label: $localize`:@@nav.item.safety:Safety`, i18nId: 'nav.item.safety', icon: 'health_and_safety', route: '/dashboard/safety' },
      { id: 'documents', label: $localize`:@@nav.item.documents:Documents`, i18nId: 'nav.item.documents', icon: 'folder_open', route: '/dashboard/documents' },
    ],
  },
  {
    id: 'integrations',
    label: $localize`:@@nav.section.integrations:Integrations`,
    i18nId: 'nav.section.integrations',
    items: [
      { id: 'procore', label: $localize`:@@nav.item.procore:Procore`, i18nId: 'nav.item.procore', icon: 'cloud_upload', route: '/dashboard/procore' },
      { id: 'kiosks', label: $localize`:@@nav.item.kiosks:Kiosks`, i18nId: 'nav.item.kiosks', icon: 'tablet', route: '/kiosk', tourId: 'tour-nav-kiosk' },
    ],
  },
];

export function visibleSections(sections: NavSection[], can: (key: string) => boolean): NavSection[] {
  return sections
    .map(s => ({ ...s, items: s.items.filter(i => !i.permission || can(i.permission)) }))
    .filter(s => s.items.length > 0);
}

export function procoreSyncLabel(
  conn: ProcoreConnection | null,
  now: Date
): { tone: 'success' | 'danger'; text: string } | null {
  if (!conn || !conn.enabled) {
    return null;
  }
  const status = conn.lastSyncStatus?.toLowerCase();
  if (status === 'failed' || status === 'error') {
    return { tone: 'danger', text: $localize`:@@nav.procore.failed:Procore sync failed` };
  }
  if (!conn.lastSyncAt) {
    return { tone: 'success', text: $localize`:@@nav.procore.connected:Procore connected` };
  }
  const at = new Date(conn.lastSyncAt);
  if (isNaN(at.getTime())) {
    return { tone: 'success', text: $localize`:@@nav.procore.connected:Procore connected` };
  }
  const diffMin = Math.floor((now.getTime() - at.getTime()) / 60000);
  if (diffMin < 0) {
    return { tone: 'success', text: $localize`:@@nav.procore.synced_today:Synced with Procore today` };
  }
  if (diffMin < 60) {
    const n = Math.max(1, diffMin);
    return { tone: 'success', text: $localize`:@@nav.procore.synced_min:Synced with Procore ${n}:n: min ago` };
  }
  if (diffMin < 1440) {
    const n = Math.floor(diffMin / 60);
    return { tone: 'success', text: $localize`:@@nav.procore.synced_hour:Synced with Procore ${n}:n: h ago` };
  }
  const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(at);
  return { tone: 'success', text: $localize`:@@nav.procore.synced_date:Synced with Procore on ${date}:date:` };
}
