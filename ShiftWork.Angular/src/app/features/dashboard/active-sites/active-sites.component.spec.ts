import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';

import { ActiveSitesComponent } from './active-sites.component';
import { ActiveSiteService } from 'src/app/core/services/active-site.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { ActiveSiteStatus } from 'src/app/core/models/active-site-status.model';

function buildSite(overrides: Partial<ActiveSiteStatus> = {}): ActiveSiteStatus {
  return {
    locationId: 1,
    name: 'Main Site',
    address: '123 Main St',
    onShiftCount: 1,
    roster: [
      {
        personId: 1,
        name: 'Alex Guard',
        roleName: 'Guard',
        clockInTime: '2026-01-01T09:00:00Z',
        timingStatus: 'OnTime',
        geofenceStatus: 'Inside',
        geofenceReviewed: false,
        shiftEventId: 'evt-1',
      },
    ],
    ...overrides,
  };
}

describe('ActiveSitesComponent', () => {
  let component: ActiveSitesComponent;
  let fixture: ComponentFixture<ActiveSitesComponent>;
  let activeSiteSvc: jasmine.SpyObj<ActiveSiteService>;
  let permSvc: jasmine.SpyObj<PermissionService>;

  beforeEach(async () => {
    activeSiteSvc = jasmine.createSpyObj('ActiveSiteService', ['getActiveSiteStatus', 'reviewGeofenceFlag']);
    activeSiteSvc.getActiveSiteStatus.and.returnValue(of([buildSite()]));

    permSvc = jasmine.createSpyObj('PermissionService', ['hasPermission']);
    permSvc.hasPermission.and.returnValue(true);

    const authServiceStub = { user$: of({ personId: 42 }) };

    await TestBed.configureTestingModule({
      imports: [ActiveSitesComponent],
      providers: [
        { provide: ActiveSiteService, useValue: activeSiteSvc },
        { provide: PermissionService, useValue: permSvc },
        { provide: AuthService, useValue: authServiceStub },
        provideMockStore({ initialState: {}, selectors: [{ selector: selectActiveCompany, value: { companyId: 'test' } }] }),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ActiveSitesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('loads active site status on init once the active company resolves', () => {
    fixture.detectChanges();
    expect(activeSiteSvc.getActiveSiteStatus).toHaveBeenCalledWith('test');
    expect(component.sites.length).toBe(1);
    expect(component.loading).toBeFalse();
  });

  it('sets an error and stops loading on failure', () => {
    activeSiteSvc.getActiveSiteStatus.and.returnValue(throwError(() => new Error('fail')));

    fixture.detectChanges();

    expect(component.error).toBeTruthy();
    expect(component.loading).toBeFalse();
  });

  it('isFlagged is true only for an unreviewed Outside geofence status', () => {
    fixture.detectChanges();
    const outsideUnreviewed = { ...component.sites[0].roster[0], geofenceStatus: 'Outside', geofenceReviewed: false };
    const outsideReviewed = { ...component.sites[0].roster[0], geofenceStatus: 'Outside', geofenceReviewed: true };
    const inside = { ...component.sites[0].roster[0], geofenceStatus: 'Inside', geofenceReviewed: false };

    expect(component.isFlagged(outsideUnreviewed)).toBeTrue();
    expect(component.isFlagged(outsideReviewed)).toBeFalse();
    expect(component.isFlagged(inside)).toBeFalse();
  });

  it('markReviewed calls the service and flips geofenceReviewed on success', () => {
    activeSiteSvc.reviewGeofenceFlag.and.returnValue(of({} as any));
    fixture.detectChanges();

    const site = component.sites[0];
    const entry = site.roster[0];
    entry.geofenceStatus = 'Outside';
    entry.geofenceReviewed = false;

    component.markReviewed(site, entry);

    expect(activeSiteSvc.reviewGeofenceFlag).toHaveBeenCalledWith('test', 'evt-1', 42);
    expect(entry.geofenceReviewed).toBeTrue();
  });

  it('canView and canReview reflect the permission service', () => {
    permSvc.hasPermission.and.callFake((key: string) => key === 'active-sites.view');
    expect(component.canView).toBeTrue();
    expect(component.canReview).toBeFalse();
  });
});

describe('ActiveSitesComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<ActiveSitesComponent>;
  let svc: jasmine.SpyObj<ActiveSiteService>;
  let perms: jasmine.SpyObj<PermissionService>;
  const el = () => fixture.nativeElement as HTMLElement;
  const outside = (extra: Record<string, unknown> = {}) => buildSite({
    roster: [{ ...buildSite().roster[0], name: 'Sam Outside', geofenceStatus: 'Outside', geofenceDistanceMeters: 120, timingStatus: 'Late', ...extra }],
  });

  async function setup(sites: ActiveSiteStatus[] | Error, canReview = true, canView = true) {
    svc = jasmine.createSpyObj('ActiveSiteService', ['getActiveSiteStatus', 'reviewGeofenceFlag']);
    svc.getActiveSiteStatus.and.returnValue(sites instanceof Error ? throwError(() => sites) : of(sites));
    svc.reviewGeofenceFlag.and.returnValue(of({} as any));
    perms = jasmine.createSpyObj('PermissionService', ['hasPermission']);
    perms.hasPermission.and.callFake((key: string) => key === 'active-sites.view' ? canView : canReview);
    await TestBed.configureTestingModule({
      imports: [ActiveSitesComponent],
      providers: [
        { provide: ActiveSiteService, useValue: svc },
        { provide: PermissionService, useValue: perms },
        { provide: AuthService, useValue: { user$: of({ personId: 42 }) } },
        provideMockStore({ initialState: {}, selectors: [{ selector: selectActiveCompany, value: { companyId: 'test' } }] }),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ActiveSitesComponent);
    await settle();
  }

  async function settle() {
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  it('renders one h1 through lz-page-header and exactly one primary button', async () => {
    await setup([buildSite()]);
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Active sites');
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el().querySelector('[variant="primary"]')!.textContent).toContain('Refresh');
    expect(el().querySelector('i.fa, .site-card, .btn-refresh, .badge')).toBeNull();
  });

  it('shows the roster in lz-table-scroll with timing and geofence as text in lz-status-chip', async () => {
    await setup([buildSite(), outside()]);
    expect(el().querySelectorAll('lz-table-scroll table').length).toBe(2);
    el().querySelectorAll('thead th').forEach(th => expect(th.getAttribute('scope')).toBe('col'));
    const chips = Array.from(el().querySelectorAll('tbody lz-status-chip')).map(c => c.textContent!.replace(/\s+/g, ' ').trim());
    expect(chips).toEqual(['On time', 'Inside', 'Late', 'Outside · 120 m away']);
    expect(el().querySelector('lz-panel h2')!.textContent).toContain('Main Site');
    expect(el().querySelector('lz-panel')!.textContent).toContain('1 on shift');
  });

  it('shows lz-empty-state when no one is clocked in, but not together with the load error', async () => {
    await setup([]);
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-table-scroll')).toBeNull();
    TestBed.resetTestingModule();
    await setup(new Error('boom'));
    expect(el().querySelector('lz-alert[role="alert"]')!.textContent).toContain('Could not load active site status');
    expect(el().querySelector('lz-empty-state')).toBeNull();
  });

  it('shows a permission message inside lz-empty-state, keeps one h1 and offers no refresh', async () => {
    await setup([], true, false);
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-empty-state')!.textContent).toContain("You don't have permission");
    expect(el().querySelector('button')).toBeNull();
    expect(svc.getActiveSiteStatus).not.toHaveBeenCalled();
  });

  it('flags an unreviewed outside entry and marks it reviewed through an accessible button', async () => {
    await setup([outside()]);
    const button = el().querySelector('[aria-label="Mark Sam Outside as reviewed"]') as HTMLElement;
    expect(button).not.toBeNull();
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    button.click();
    await settle();
    expect(svc.reviewGeofenceFlag).toHaveBeenCalledWith('test', 'evt-1', 42);
    expect(el().querySelector('[aria-label="Mark Sam Outside as reviewed"]')).toBeNull();
    expect(el().querySelector('tbody')!.textContent).toContain('Outside, reviewed');
  });

  it('a failed review shows an alert and keeps the button', async () => {
    await setup([outside()]);
    svc.reviewGeofenceFlag.and.returnValue(throwError(() => new Error('boom')));
    (el().querySelector('[aria-label="Mark Sam Outside as reviewed"]') as HTMLElement).click();
    await settle();
    expect(el().querySelector('lz-alert[role="alert"]')!.textContent).toContain('Could not mark the flag as reviewed');
    expect(el().querySelector('[aria-label="Mark Sam Outside as reviewed"]')).not.toBeNull();
  });

  it('hides review actions without the review permission', async () => {
    await setup([outside()], false);
    expect(el().querySelector('[aria-label="Mark Sam Outside as reviewed"]')).toBeNull();
    expect(el().querySelectorAll('thead th').length).toBe(6);
  });

  it('refresh button is at least 48px and the title uses the 26px size', async () => {
    await setup([buildSite()]);
    const refresh = el().querySelector('[variant="primary"]') as HTMLElement;
    expect(refresh.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(getComputedStyle(el().querySelector('h1')!).fontSize).toBe('26px');
    expect(getComputedStyle(el().querySelector('tbody lz-status-chip span')!).fontSize).toBe('12px');
  });

  for (const width of [360, 768]) {
    it(`contains the roster table inside lz-table-scroll without page overflow at ${width}px`, async () => {
      await setup([buildSite()]);
      const host = el();
      host.style.display = 'block';
      host.style.width = `${Math.min(width, window.innerWidth)}px`;
      const scroll = el().querySelector('lz-table-scroll') as HTMLElement;
      expect(getComputedStyle(scroll).overflowX).toBe('auto');
      expect(scroll.clientWidth).toBeLessThanOrEqual(width);
      if (width === 360) {
        expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
      }
      expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
      expect(document.body.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    });
  }
});
