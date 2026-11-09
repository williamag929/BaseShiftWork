import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { Observable, of, throwError } from 'rxjs';
import { CostCode } from 'src/app/core/models/cost-code.model';
import { CostCodeService } from 'src/app/core/services/cost-code.service';
import { LocationService } from 'src/app/core/services/location.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import {
  LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzFieldComponent, LzFieldDirective, LzPageHeaderComponent,
  LzPagerComponent, LzSidePanelComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent,
} from 'src/app/shared/ui';
import { CostCodesComponent } from './cost-codes.component';

describe('CostCodesComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<CostCodesComponent>;
  let service: Record<string, jasmine.Spy>;
  let toastr: Record<string, jasmine.Spy>;
  let locations: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;
  const code = (id: number, extra: Partial<CostCode> = {}): CostCode => ({
    costCodeId: id, code: `01-${100 + id}`, name: `Labor ${id}`, companyId: 'c1', locationId: null, externalCode: null, status: 'Active', ...extra,
  } as CostCode);
  const many = (n: number) => Array.from({ length: n }, (_, i) => code(i + 1));
  const panel = () => document.querySelector('lz-side-panel [role="dialog"]') as HTMLElement | null;

  async function setup(codes: CostCode[] | Observable<CostCode[]>) {
    service = {
      getCostCodes: jasmine.createSpy('getCostCodes').and.returnValue(Array.isArray(codes) ? of(codes) : codes),
      createCostCode: jasmine.createSpy('createCostCode').and.callFake((_c: string, c: CostCode) => of({ ...c, costCodeId: 99 })),
      updateCostCode: jasmine.createSpy('updateCostCode').and.callFake((_c: string, _id: number, c: CostCode) => of(c)),
    };
    locations = jasmine.createSpy('getLocations').and.returnValue(of([{ locationId: 7, name: 'HQ', companyId: 'c1' }]));
    toastr = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
    await TestBed.configureTestingModule({
      declarations: [CostCodesComponent],
      imports: [
        ReactiveFormsModule, MatIconModule, LzButtonDirective, LzPageHeaderComponent, LzSidePanelComponent, LzPagerComponent,
        LzFieldComponent, LzFieldDirective, LzAlertComponent, LzEmptyStateComponent, LzTableDirective, LzTableScrollComponent,
        LzStatusChipComponent,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'c1' } }] }),
        { provide: CostCodeService, useValue: service },
        { provide: LocationService, useValue: { getLocations: locations } },
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CostCodesComponent);
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

  it('renders one h1 through lz-page-header and exactly one primary button', async () => {
    await setup([code(1)]);
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Cost codes');
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el().querySelector('[variant="primary"]')!.textContent).toContain('Add cost code');
    expect(el().querySelector('i.fa, .panel-card, .btn, .btn-submit')).toBeNull();
  });

  it('the header add button becomes secondary while the panel is open and the panel holds the only primary', async () => {
    await setup([code(1)]);
    await click(el().querySelector('lz-page-header button'));
    expect(el().querySelector('lz-page-header button')!.getAttribute('variant')).toBe('secondary');
    expect(document.querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(panel()!.querySelector('[variant="primary"]')).not.toBeNull();
  });

  it('lists cost codes in lz-table-scroll with location, Procore id and status text', async () => {
    await setup([code(1, { locationId: 7, externalCode: 'P-9' }), code(2, { status: 'Inactive' })]);
    expect(el().querySelector('lz-table-scroll table')).not.toBeNull();
    el().querySelectorAll('thead th').forEach(th => expect(th.getAttribute('scope')).toBe('col'));
    const first = el().querySelector('tbody tr')!.textContent!;
    expect(first).toContain('01-101');
    expect(first).toContain('HQ');
    expect(first).toContain('P-9');
    expect(el().querySelectorAll('tbody tr')[1].textContent).toContain('All locations');
    expect(Array.from(el().querySelectorAll('lz-status-chip')).map(c => c.textContent!.trim())).toEqual(['Active', 'Inactive']);
    expect(el().querySelector('[aria-label="Edit 01-101"]')).not.toBeNull();
  });

  it('shows lz-empty-state and no table when there are no cost codes', async () => {
    await setup([]);
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-table-scroll')).toBeNull();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
  });

  it('shows only an lz-alert, not the empty state, when loading fails', async () => {
    await setup(throwError(() => new Error('boom')));
    expect(el().querySelector('lz-alert[role="alert"]')!.textContent).toContain('Error loading cost codes');
    expect(el().querySelector('lz-empty-state')).toBeNull();
  });

  it('renders no form until the panel opens', async () => {
    await setup([code(1)]);
    expect(el().querySelector('form')).toBeNull();
    expect(document.querySelector('form')).toBeNull();
    await click(el().querySelector('lz-page-header button'));
    expect(panel()!.querySelector('form')).not.toBeNull();
    expect(panel()!.querySelector('h2')!.textContent).toContain('Add cost code');
  });

  it('marks required fields with a visible asterisk and aria-required', async () => {
    await setup([]);
    await click(el().querySelector('lz-page-header button'));
    for (const id of ['code', 'name']) {
      expect(panel()!.querySelector(`lz-field label[for="${id}"]`)!.textContent).toContain('*');
      expect(panel()!.querySelector(`#${id}`)!.getAttribute('aria-required')).toBe('true');
    }
    expect(panel()!.querySelector('lz-field label[for="description"]')!.textContent).not.toContain('*');
  });

  it('renders only 25 rows of 120 and pages forward', async () => {
    await setup(many(120));
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
    expect(el().querySelector('lz-pager')!.textContent).toContain('1–25 of 120');
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(el().querySelector('tbody tr')!.textContent).toContain('01-126');
  });

  it('clamps the page when a reload returns fewer cost codes', async () => {
    await setup(many(26));
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
    service['getCostCodes'].and.returnValue(of(many(25)));
    fixture.componentInstance.ngOnInit();
    await settle();
    expect(fixture.componentInstance.page).toBe(1);
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
  });

  it('clicking a row opens the panel with its values and the action button does not double-fire', async () => {
    await setup([code(1, { description: 'Site work', locationId: 7 })]);
    const opened = spyOn(fixture.componentInstance, 'editCostCode').and.callThrough();
    await click(el().querySelector('[aria-label="Edit 01-101"]'));
    expect(opened).toHaveBeenCalledTimes(1);
    expect(panel()!.querySelector('h2')!.textContent).toContain('01-101');
    expect((panel()!.querySelector('#name') as HTMLInputElement).value).toBe('Labor 1');
    expect((panel()!.querySelector('#locationId') as HTMLSelectElement).value).toBe('7');
  });

  it('creating a cost code normalises empty scope to null, shows a localized toast and closes the panel', async () => {
    await setup([]);
    await click(el().querySelector('lz-page-header button'));
    expect(panel()!.querySelector('button[type="submit"]')!.hasAttribute('disabled')).toBeTrue();
    await type(panel()!, '#code', '02-200');
    await type(panel()!, '#name', 'Concrete');
    await click(panel()!.querySelector('button[type="submit"]'));
    const sent = service['createCostCode'].calls.mostRecent().args[1];
    expect(sent.code).toBe('02-200');
    expect(sent.locationId).toBeNull();
    expect(sent.externalCode).toBeNull();
    expect(toastr['success']).toHaveBeenCalledWith('Cost code created.');
    expect(panel()).toBeNull();
    expect(el().querySelector('tbody')!.textContent).toContain('Concrete');
  });

  it('a failed create shows a localized error toast, keeps the panel open and re-enables saving', async () => {
    await setup([]);
    service['createCostCode'].and.returnValue(throwError(() => new Error('boom')));
    await click(el().querySelector('lz-page-header button'));
    await type(panel()!, '#code', '02-200');
    await type(panel()!, '#name', 'Concrete');
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(toastr['error']).toHaveBeenCalledWith('Could not create the cost code.');
    expect(panel()).not.toBeNull();
    expect(fixture.componentInstance.saving).toBeFalse();
  });

  it('a failed update shows a localized error toast', async () => {
    await setup([code(1)]);
    service['updateCostCode'].and.returnValue(throwError(() => new Error('boom')));
    await click(el().querySelector('tbody tr'));
    await type(panel()!, '#name', 'Renamed');
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(toastr['error']).toHaveBeenCalledWith('Could not update the cost code.');
    expect(panel()).not.toBeNull();
  });

  it('shows required messages with an alert role once a field is touched and empty', async () => {
    await setup([]);
    await click(el().querySelector('lz-page-header button'));
    const codeInput = panel()!.querySelector('#code') as HTMLInputElement;
    codeInput.dispatchEvent(new Event('blur'));
    await settle();
    expect(panel()!.querySelector('#code-error')!.textContent).toContain('Code is required');
    expect(panel()!.querySelector('#code-error')!.getAttribute('role')).toBe('alert');
    expect(codeInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('saving an edit is disabled until the form changes, then updates', async () => {
    await setup([code(1)]);
    await click(el().querySelector('tbody tr'));
    const submit = panel()!.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBeTrue();
    await type(panel()!, '#name', 'Renamed');
    expect(submit.disabled).toBeFalse();
    await click(submit);
    expect(service['updateCostCode']).toHaveBeenCalled();
    expect(toastr['success']).toHaveBeenCalledWith('Cost code updated.');
  });

  it('closing a dirty panel asks to discard instead of closing', async () => {
    await setup([code(1)]);
    await click(el().querySelector('lz-page-header button'));
    await type(panel()!, '#code', 'x');
    await click(panel()!.querySelector('[aria-label="Close"]'));
    expect(panel()!.textContent).toContain('Discard your changes?');
  });

  it('closing the panel restores focus to the opener', async () => {
    await setup([code(1)]);
    const opener = el().querySelector('[aria-label="Edit 01-101"]') as HTMLElement;
    opener.focus();
    await click(opener);
    await click(panel()!.querySelector('[aria-label="Close"]'));
    await settle();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps row action and form control targets at 48px', async () => {
    await setup([code(1)]);
    const button = el().querySelector('[aria-label="Edit 01-101"]') as HTMLElement;
    expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(48);
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    await click(button);
    for (const field of Array.from(panel()!.querySelectorAll('input[lzField], select[lzField]'))) {
      expect(field.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    }
    for (const b of Array.from(panel()!.querySelectorAll('button'))) {
      expect(b.getBoundingClientRect().height).withContext(b.textContent!.trim() || b.className).toBeGreaterThanOrEqual(48);
    }
  });

  for (const width of [360, 768]) {
    it(`contains the table inside lz-table-scroll without page overflow at ${width}px`, async () => {
      await setup(many(3));
      const host = fixture.nativeElement as HTMLElement;
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
