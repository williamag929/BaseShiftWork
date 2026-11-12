import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { Observable, of, throwError } from 'rxjs';
import { Area } from 'src/app/core/models/area.model';
import { AreaService } from 'src/app/core/services/area.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { CostCodeService } from 'src/app/core/services/cost-code.service';
import { LocationService } from 'src/app/core/services/location.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import {
  LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzFieldComponent, LzFieldDirective, LzPageHeaderComponent,
  LzPagerComponent, LzSidePanelComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent,
} from 'src/app/shared/ui';
import { AreasComponent } from './areas.component';

describe('AreasComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<AreasComponent>;
  let service: Record<string, jasmine.Spy>;
  let toastr: Record<string, jasmine.Spy>;
  const el = () => fixture.nativeElement as HTMLElement;
  const area = (id: number, extra: Partial<Area> = {}): Area => ({
    areaId: id, name: `Area ${id}`, companyId: 'c1', locationId: '7', costCodeId: null, status: 'Active', ...extra,
  });
  const many = (n: number) => Array.from({ length: n }, (_, i) => area(i + 1));
  const panel = () => document.querySelector('lz-side-panel [role="dialog"]') as HTMLElement | null;

  async function setup(areas: Area[] | Observable<Area[]>) {
    service = {
      getAreas: jasmine.createSpy('getAreas').and.returnValue(Array.isArray(areas) ? of(areas) : areas),
      createArea: jasmine.createSpy('createArea').and.callFake((_c: string, a: Area) => of({ ...a, areaId: 99 })),
      updateArea: jasmine.createSpy('updateArea').and.callFake((_c: string, _id: number, a: Area) => of(a)),
    };
    toastr = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
    await TestBed.configureTestingModule({
      declarations: [AreasComponent],
      imports: [
        ReactiveFormsModule, MatIconModule, LzButtonDirective, LzPageHeaderComponent, LzSidePanelComponent, LzPagerComponent,
        LzFieldComponent, LzFieldDirective, LzAlertComponent, LzEmptyStateComponent, LzTableDirective, LzTableScrollComponent,
        LzStatusChipComponent,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'c1' } }] }),
        { provide: AreaService, useValue: service },
        { provide: LocationService, useValue: { getLocations: () => of([{ locationId: 7, name: 'HQ', companyId: 'c1' }]) } },
        { provide: CostCodeService, useValue: { getCostCodes: () => of([{ costCodeId: 3, code: '01-100', name: 'Labor', companyId: 'c1' }]) } },
        { provide: AuthService, useValue: {} },
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AreasComponent);
    await settle();
  }

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const click = async (target: Element | null) => {
    (target as HTMLElement).click();
    await settle();
  };

  const type = async (root: ParentNode, selector: string, value: string) => {
    const input = root.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  const choose = async (root: ParentNode, selector: string, value: string) => {
    const select = root.querySelector(selector) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await settle();
  };

  it('renders one h1 through lz-page-header and exactly one primary button', async () => {
    await setup([area(1)]);
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Area management');
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el().querySelector('[variant="primary"]')!.textContent).toContain('Add area');
    expect(el().querySelector('i.fa, .panel-card, .btn, .btn-submit')).toBeNull();
  });

  it('lists areas in lz-table-scroll with location and cost code, and no status the API does not store', async () => {
    await setup([area(1, { costCodeId: 3 }), area(2)]);
    expect(el().querySelector('lz-table-scroll table')).not.toBeNull();
    el().querySelectorAll('thead th').forEach(th => expect(th.getAttribute('scope')).toBe('col'));
    const first = el().querySelector('tbody tr')!.textContent!;
    expect(first).toContain('HQ');
    expect(first).toContain('01-100 — Labor');
    expect(el().querySelector('lz-status-chip')).toBeNull();
    expect(el().querySelector('#status')).toBeNull();
    expect(el().querySelector('[aria-label="Edit Area 1"]')).not.toBeNull();
  });

  it('shows lz-empty-state and no table when there are no areas', async () => {
    await setup([]);
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-table-scroll')).toBeNull();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
  });

  it('shows only an lz-alert, not the empty state, when loading fails', async () => {
    await setup(throwError(() => new Error('boom')));
    expect(el().querySelector('lz-alert[role="alert"]')!.textContent).toContain('Error loading areas');
    expect(el().querySelector('lz-empty-state')).toBeNull();
  });

  it('renders no form until the panel opens', async () => {
    await setup([area(1)]);
    expect(el().querySelector('form')).toBeNull();
    expect(document.querySelector('form')).toBeNull();
    await click(el().querySelector('lz-page-header button'));
    expect(panel()!.querySelector('form')).not.toBeNull();
    expect(panel()!.querySelector('h2')!.textContent).toContain('Add area');
  });

  it('marks required fields with a visible asterisk', async () => {
    await setup([]);
    await click(el().querySelector('lz-page-header button'));
    for (const id of ['name', 'locationId']) {
      expect(panel()!.querySelector(`lz-field label[for="${id}"]`)!.textContent).toContain('*');
    }
  });

  it('renders only 25 rows of 120 and pages forward', async () => {
    await setup(many(120));
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
    expect(el().querySelector('lz-pager')!.textContent).toContain('1–25 of 120');
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(el().querySelector('tbody tr')!.textContent).toContain('Area 26');
  });

  it('clicking a row opens the panel titled with the area name and its values', async () => {
    await setup([area(1, { name: 'Kitchen', costCodeId: 3 })]);
    await click(el().querySelector('tbody tr'));
    expect(panel()!.querySelector('h2')!.textContent).toContain('Kitchen');
    expect((panel()!.querySelector('#name') as HTMLInputElement).value).toBe('Kitchen');
    expect((panel()!.querySelector('#costCodeId') as HTMLSelectElement).value).toBe('3');
  });

  it('creating an area calls the service, shows a localized toast and closes the panel', async () => {
    await setup([]);
    await click(el().querySelector('lz-page-header button'));
    expect(panel()!.querySelector('button[type="submit"]')!.hasAttribute('disabled')).toBeTrue();
    await type(panel()!, '#name', 'Dock');
    await choose(panel()!, '#locationId', '7');
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(service['createArea']).toHaveBeenCalled();
    expect(service['createArea'].calls.mostRecent().args[1].name).toBe('Dock');
    expect(toastr['success']).toHaveBeenCalledWith('Area created.');
    expect(panel()).toBeNull();
    expect(el().querySelector('tbody')!.textContent).toContain('Dock');
  });

  it('a failed create shows a localized error toast and keeps the panel open', async () => {
    await setup([]);
    service['createArea'].and.returnValue(throwError(() => new Error('boom')));
    await click(el().querySelector('lz-page-header button'));
    await type(panel()!, '#name', 'Dock');
    await choose(panel()!, '#locationId', '7');
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(toastr['error']).toHaveBeenCalledWith('Could not create the area.');
    expect(panel()).not.toBeNull();
  });

  it('shows a required message with an alert role once the name is touched and empty', async () => {
    await setup([]);
    await click(el().querySelector('lz-page-header button'));
    const name = panel()!.querySelector('#name') as HTMLInputElement;
    name.dispatchEvent(new Event('blur'));
    await settle();
    expect(panel()!.querySelector('#name-error')!.textContent).toContain('Area name is required');
    expect(name.getAttribute('aria-invalid')).toBe('true');
  });

  it('saving an edit is disabled until the form changes, then updates', async () => {
    await setup([area(1)]);
    await click(el().querySelector('tbody tr'));
    const submit = panel()!.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBeTrue();
    await type(panel()!, '#name', 'Renamed');
    expect(submit.disabled).toBeFalse();
    await click(submit);
    expect(service['updateArea']).toHaveBeenCalled();
    expect(toastr['success']).toHaveBeenCalledWith('Area updated.');
  });

  it('closing a dirty panel asks to discard instead of closing', async () => {
    await setup([area(1)]);
    await click(el().querySelector('lz-page-header button'));
    await type(panel()!, '#name', 'x');
    await click(panel()!.querySelector('[aria-label="Close"]'));
    expect(panel()!.textContent).toContain('Discard your changes?');
  });

  it('closing the panel restores focus to the opener', async () => {
    await setup([area(1)]);
    const opener = el().querySelector('[aria-label="Edit Area 1"]') as HTMLElement;
    opener.focus();
    await click(opener);
    await click(panel()!.querySelector('[aria-label="Close"]'));
    await settle();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps row action and form control targets at 48px', async () => {
    await setup([area(1)]);
    const button = el().querySelector('[aria-label="Edit Area 1"]') as HTMLElement;
    expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(48);
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    await click(button);
    for (const field of Array.from(panel()!.querySelectorAll('input[lzField], select[lzField]'))) {
      expect(field.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    }
    for (const b of Array.from(panel()!.querySelectorAll('button:not(app-audit-history-button button)'))) {
      expect(b.getBoundingClientRect().height).withContext(b.textContent!.trim() || b.className).toBeGreaterThanOrEqual(48);
    }
  });

  for (const width of [360, 768]) {
    it(`contains the table inside lz-table-scroll without page overflow at ${width}px`, async () => {
      await setup(many(3));
      const host = fixture.nativeElement as HTMLElement;
      host.style.display = 'block';
      host.style.width = `${width}px`;
      const scroll = el().querySelector('lz-table-scroll') as HTMLElement;
      expect(getComputedStyle(scroll).overflowX).toBe('auto');
      expect(scroll.clientWidth).toBeLessThanOrEqual(width);
      expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
    });
  }
});
