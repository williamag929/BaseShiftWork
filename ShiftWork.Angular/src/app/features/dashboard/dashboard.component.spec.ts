import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { provideMockStore } from '@ngrx/store/testing';
import { BehaviorSubject, of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { CredentialService } from 'src/app/core/services/credential.service';
import { BillingService } from 'src/app/core/services/billing.service';
import { ProcoreService } from 'src/app/core/services/procore.service';
import { TourService } from 'src/app/shared/tour/tour.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { LzButtonDirective, LzStatusChipComponent } from 'src/app/shared/ui';
import { NAV_SECTIONS, visibleSections } from './nav/nav.config';
import './dashboard.module';

@Component({ template: '', standalone: true })
class StubPage {}

describe('DashboardComponent shell', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let procore: jasmine.SpyObj<ProcoreService>;

  async function setup(opts: { can?: (k: string) => boolean; connection?: any } = {}) {
    localStorage.removeItem('lz.nav.collapsed');
    procore = jasmine.createSpyObj('ProcoreService', ['getConnection']);
    procore.getConnection.and.returnValue(of(opts.connection ?? null));
    const perm = { hasPermission: opts.can ?? (() => true) };
    const billing = { refresh: () => {}, summary$: new BehaviorSubject(null) };
    const tour = jasmine.createSpyObj('TourService', ['startTour', 'shouldAutoStart'], { active$: of(false), stepIndex$: of(0), currentStep: null });
    tour.shouldAutoStart.and.returnValue(false);
    await TestBed.configureTestingModule({
      declarations: [DashboardComponent],
      imports: [NoopAnimationsModule, MatSidenavModule, MatMenuModule, MatIconModule, MatTooltipModule, MatDividerModule, LzButtonDirective, LzStatusChipComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubPage, children: [{ path: 'people', component: StubPage }] },
        ]),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'co-1', name: 'Acme' } }] }),
        { provide: AuthService, useValue: { user$: of({ name: 'Ann', email: 'a@b.c' }), signOut: () => {} } },
        { provide: PeopleService, useValue: { getPersonStatus: () => of(null) } },
        { provide: PermissionService, useValue: perm },
        { provide: CredentialService, useValue: { getExpiring: () => of({ expiredCount: 0, expiringSoonCount: 0 }) } },
        { provide: BillingService, useValue: billing },
        { provide: ProcoreService, useValue: procore },
        { provide: TourService, useValue: tour },
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false, breakpoints: {} }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;

  it('renders one nav heading per visible section', async () => {
    await setup({ can: k => k !== 'active-sites.view' && k !== 'credentials.read' });
    const expected = visibleSections(NAV_SECTIONS, k => k !== 'active-sites.view' && k !== 'credentials.read').length;
    expect(el().querySelectorAll('[data-nav-heading]').length).toBe(expected);
    expect(expected).toBe(5);
    expect(el().querySelectorAll('[data-nav-label]').length).toBe(visibleSections(NAV_SECTIONS, k => k !== 'active-sites.view' && k !== 'credentials.read').flatMap(x => x.items).length);
  });

  it('marks the active item with aria-current="page"', async () => {
    await setup();
    await TestBed.inject(Router).navigateByUrl('/dashboard/people');
    fixture.detectChanges();
    const current = el().querySelectorAll('a[aria-current="page"]');
    expect(current.length).toBe(1);
    expect(current[0].getAttribute('href')).toBe('/dashboard/people');
  });

  it('shows the Procore chip only when a connection is enabled', async () => {
    await setup();
    expect(el().querySelector('[data-procore-chip]')).toBeNull();
    fixture.destroy();
    TestBed.resetTestingModule();
    await setup({ connection: { enabled: true, lastSyncStatus: 'failed' } });
    const chip = el().querySelector('[data-procore-chip]');
    expect(chip?.textContent).toContain('Procore sync failed');
  });

  it('nav labels never truncate', async () => {
    await setup();
    const labels = el().querySelectorAll('[data-nav-label]');
    expect(labels.length).toBeGreaterThan(10);
    labels.forEach(l => {
      expect(l.classList.contains('whitespace-normal')).toBeTrue();
      expect(l.classList.contains('truncate')).toBeFalse();
      expect(l.classList.contains('text-ellipsis')).toBeFalse();
    });
  });

  it('sizes the rail 232px expanded and 64px collapsed with the toggle inside it', async () => {
    await setup();
    const rail = el().querySelector('mat-sidenav') as HTMLElement;
    expect(Math.round(rail.getBoundingClientRect().width)).toBe(232);
    fixture.componentInstance.toggleCollapsed();
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 300));
    expect(Math.round(rail.getBoundingClientRect().width)).toBe(64);
    const toggle = rail.querySelector('button[aria-expanded]') as HTMLElement;
    const r = toggle.getBoundingClientRect();
    const rr = rail.getBoundingClientRect();
    expect(r.left).toBeGreaterThanOrEqual(rr.left);
    expect(r.right).toBeLessThanOrEqual(rr.right + 0.5);
    expect(r.width).toBeGreaterThanOrEqual(48);
  });
});
