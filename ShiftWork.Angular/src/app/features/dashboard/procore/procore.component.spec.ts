import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { ProcoreConnection } from 'src/app/core/models/procore-connection.model';
import { LocationService } from 'src/app/core/services/location.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { ProcoreService } from 'src/app/core/services/procore.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import {
  LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzFieldComponent, LzFieldDirective, LzPageHeaderComponent, LzPagerComponent,
  LzPanelComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent,
} from 'src/app/shared/ui';
import { ProcoreComponent } from './procore.component';

const connection = (over: Partial<ProcoreConnection> = {}): ProcoreConnection => ({
  procoreCompanyId: '598134', clientId: 'cid', hasClientSecret: true, baseUrl: 'https://api.procore.com', tokenUrl: 'https://login.procore.com/oauth/token',
  enabled: true, autoPushOnSubmit: true, timesheetSyncEnabled: false, lastSyncAt: '2026-01-15T10:00:00Z', lastSyncStatus: 'Success', ...over,
} as ProcoreConnection);
const loc = (i: number) => ({ locationId: i, name: `Site ${i}`, city: 'Newark', state: 'NJ', companyId: 'c1', externalCode: i === 1 ? 'P-1' : '' });
const person = (i: number) => ({ personId: i, name: `Person ${i}`, email: `p${i}@x.com`, companyId: 'c1', externalCode: '' });

describe('ProcoreComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<ProcoreComponent>;
  let procore: Record<string, jasmine.Spy>;
  let locations: Record<string, jasmine.Spy>;
  let people: Record<string, jasmine.Spy>;
  let toastr: Record<string, jasmine.Spy>;
  const el = () => fixture.nativeElement as HTMLElement;

  afterEach(() => selectActiveCompany.clearResult());

  async function setup(o: { conn?: ProcoreConnection | null; locs?: any[]; ppl?: any[]; fail?: boolean } = {}) {
    TestBed.resetTestingModule();
    procore = {
      getConnection: jasmine.createSpy().and.returnValue(o.fail ? throwError(() => new Error('x')) : of(o.conn === undefined ? connection() : o.conn)),
      saveConnection: jasmine.createSpy().and.callFake((_c: string, input: any) => of(connection(input))),
      testConnection: jasmine.createSpy().and.returnValue(of({ success: true, message: '' })),
    };
    locations = {
      getLocations: jasmine.createSpy().and.returnValue(of(o.locs ?? [loc(1), loc(2)])),
      updateLocation: jasmine.createSpy().and.returnValue(of(undefined)),
    };
    people = {
      getPeople: jasmine.createSpy().and.returnValue(of(o.ppl ?? [person(1), person(2)])),
      updatePerson: jasmine.createSpy().and.returnValue(of(undefined)),
    };
    toastr = { success: jasmine.createSpy(), error: jasmine.createSpy(), warning: jasmine.createSpy() };
    await TestBed.configureTestingModule({
      declarations: [ProcoreComponent],
      imports: [
        FormsModule, ReactiveFormsModule, MatIconModule, LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzFieldComponent, LzFieldDirective,
        LzPageHeaderComponent, LzPagerComponent, LzPanelComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'c1' } }] }),
        { provide: ProcoreService, useValue: procore },
        { provide: LocationService, useValue: locations },
        { provide: PeopleService, useValue: people },
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProcoreComponent);
    await settle();
  }
  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const click = async (t: Element | null) => { (t as HTMLElement).click(); await settle(); };

  it('renders one h1 and exactly one primary button (Save connection) with no legacy markup', async () => {
    await setup();
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Procore integration');
    const primary = el().querySelectorAll('[variant="primary"]');
    expect(primary.length).toBe(1);
    expect(primary[0].textContent).toContain('Save connection');
    expect(el().querySelector('i.fa, .panel-card, .btn-submit, .form-input')).toBeNull();
    expect(getComputedStyle(el().querySelector('h1')!).fontSize).toBe('26px');
  });

  it('shows the enabled state as a chip with text and a visible last-sync line with its status chip', async () => {
    await setup();
    const headerChip = el().querySelector('lz-page-header lz-status-chip')!;
    expect(headerChip.textContent!.trim()).toBe('Enabled');
    const line = el().querySelector('[data-testid="last-sync"]')!;
    expect(line.textContent).toContain('Last sync:');
    expect(line.querySelector('lz-status-chip')!.textContent!.trim()).toBe('Success');
    await setup({ conn: connection({ lastSyncStatus: 'Failed', enabled: false }) });
    expect(el().querySelector('lz-page-header lz-status-chip')!.textContent!.trim()).toBe('Disabled');
  });

  it('says so when it has never synced', async () => {
    await setup({ conn: connection({ lastSyncAt: null as any, lastSyncStatus: null as any }) });
    const line = el().querySelector('[data-testid="last-sync"]')!;
    expect(line.textContent).toContain('never');
    expect(line.querySelector('lz-status-chip')!.textContent!.trim()).toBe('Not synced');
  });

  it('marks the base and token URLs as required and blocks saving when one is empty', async () => {
    await setup();
    expect(el().querySelector('label[for="procore-base-url"]')!.textContent).toContain('*');
    expect(el().querySelector('label[for="procore-token-url"]')!.textContent).toContain('*');
    const input = el().querySelector('#procore-base-url') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await settle();
    expect((el().querySelector('[variant="primary"]') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('saves the connection with the same payload and keeps a blank secret undefined', async () => {
    await setup();
    await click(el().querySelector('[variant="primary"]'));
    expect(procore['saveConnection']).toHaveBeenCalledWith('c1', {
      procoreCompanyId: '598134', clientId: 'cid', clientSecret: undefined, baseUrl: 'https://api.procore.com',
      tokenUrl: 'https://login.procore.com/oauth/token', enabled: true, autoPushOnSubmit: true, timesheetSyncEnabled: false,
    });
    expect(toastr['success']).toHaveBeenCalledWith('Procore connection saved.');
  });

  it('tests the connection and toasts success, warning and failure', async () => {
    await setup();
    const test = Array.from(el().querySelectorAll('button')).find(b => b.textContent!.includes('Test connection'))!;
    await click(test);
    expect(procore['testConnection']).toHaveBeenCalledWith('c1');
    expect(toastr['success']).toHaveBeenCalledWith('Connected to Procore.');
    procore['testConnection'].and.returnValue(of({ success: false, message: 'Nope' }));
    await click(test);
    expect(toastr['warning']).toHaveBeenCalledWith('Nope');
    procore['testConnection'].and.returnValue(throwError(() => new Error('x')));
    await click(test);
    expect(toastr['error']).toHaveBeenCalledWith('Connection test failed.');
  });

  it('saves a project mapping from the row and reports failures', async () => {
    await setup();
    const input = el().querySelector('[aria-label="Procore project ID for Site 2"]') as HTMLInputElement;
    input.value = 'P-22';
    input.dispatchEvent(new Event('input'));
    await click(el().querySelector('[aria-label="Save mapping for Site 2"]'));
    expect(locations['updateLocation']).toHaveBeenCalled();
    expect(locations['updateLocation'].calls.mostRecent().args[2].externalCode).toBe('P-22');
    expect(toastr['success']).toHaveBeenCalledWith('Mapping saved for Site 2.');
    locations['updateLocation'].and.returnValue(throwError(() => new Error('x')));
    await click(el().querySelector('[aria-label="Save mapping for Site 2"]'));
    expect(toastr['error']).toHaveBeenCalledWith('Could not save mapping for Site 2.');
  });

  it('filters employees by search, resets to page 1 and shows a no-match message', async () => {
    await setup({ ppl: Array.from({ length: 60 }, (_, i) => person(i + 1)) });
    const emp = () => el().querySelectorAll('lz-panel')[2];
    expect(emp().querySelectorAll('tbody tr').length).toBe(25);
    await click(emp().querySelector('lz-pager [aria-label="Next page"]'));
    expect(fixture.componentInstance.empPage).toBe(2);
    const search = el().querySelector('#procore-search') as HTMLInputElement;
    search.value = 'Person 5';
    search.dispatchEvent(new Event('input'));
    await settle();
    expect(fixture.componentInstance.empPage).toBe(1);
    expect(emp().querySelectorAll('tbody tr').length).toBe(11);
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    await settle();
    expect(emp().textContent).toContain('No employees match your search.');
    expect(emp().querySelector('lz-empty-state')).toBeNull();
  });

  it('pages more than 25 locations', async () => {
    await setup({ locs: Array.from({ length: 30 }, (_, i) => loc(i + 1)) });
    const panel = el().querySelectorAll('lz-panel')[1];
    expect(panel.querySelectorAll('tbody tr').length).toBe(25);
    await click(panel.querySelector('lz-pager [aria-label="Next page"]'));
    expect(panel.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('uses empty states for no locations or employees and an alert only on load failure', async () => {
    await setup({ locs: [], ppl: [] });
    expect(el().querySelectorAll('lz-empty-state').length).toBe(2);
    await setup({ fail: true });
    expect(el().querySelector('lz-alert[role="alert"]')).not.toBeNull();
    expect(el().querySelector('lz-empty-state')).toBeNull();
  });

  it('gives targets the accessible sizes and keeps tables inside lz-table-scroll', async () => {
    await setup();
    const check = el().querySelector('input[type="checkbox"]') as HTMLElement;
    expect(check.getBoundingClientRect().width).toBeGreaterThanOrEqual(24);
    expect((check.closest('label') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect((el().querySelector('[aria-label="Save mapping for Site 1"]') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect((el().querySelector('#procore-company-id') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    el().querySelectorAll('lz-table-scroll').forEach(s => expect(getComputedStyle(s).overflowX).toBe('auto'));
  });
});
