import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { People } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { PtoService } from 'src/app/core/services/pto.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { PeopleManagementComponent } from './people-management.component';

describe('PeopleManagementComponent - Time off settings (Loqzen design system)', () => {
  let fixture: ComponentFixture<PeopleManagementComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  const person = (i: number, overrides: Partial<People> = {}): People =>
    ({ personId: i, name: `Person ${String(i).padStart(2, '0')}`, companyId: 'c1', email: `p${i}@example.com`, ...overrides } as People);

  async function setup(people: People[]) {
    await TestBed.configureTestingModule({
      imports: [PeopleManagementComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'c1' } }] }),
        { provide: PeopleService, useValue: { getPeople: () => of(people) } },
        { provide: PtoService, useValue: { getBalance: () => of({ balance: 12 }), configurePto: () => of({}) } },
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PeopleManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('has one h1 from lz-page-header and no legacy icon, card or button classes', async () => {
    await setup([person(1)]);
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')).not.toBeNull();
    expect(el().querySelector('i.fas, .person-card, .search-card, .btn-pto, .pagination-btn')).toBeNull();
  });

  it('lists people in a table inside lz-table-scroll', async () => {
    await setup([person(1), person(2, { email: '' as any })]);
    const scroll = el().querySelector('lz-table-scroll') as HTMLElement;
    expect(scroll).not.toBeNull();
    expect(scroll.querySelectorAll('tbody tr').length).toBe(2);
    expect(getComputedStyle(scroll).overflowX).toBe('auto');
    expect(scroll.textContent).toContain('No contact information available');
  });

  it('pages with lz-pager + paginate at 15 rows per page', async () => {
    await setup(Array.from({ length: 20 }, (_, i) => person(i + 1)));
    expect(el().querySelectorAll('tbody tr').length).toBe(15);
    const pager = el().querySelector('lz-pager')!;
    expect(pager.textContent).toContain('1–15 of 20');
    (pager.querySelector('button[aria-label="Next page"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelectorAll('tbody tr').length).toBe(5);
  });

  it('search filters rows and resets to page 1; empty result shows lz-empty-state', async () => {
    await setup(Array.from({ length: 20 }, (_, i) => person(i + 1)));
    const search = el().querySelector('input[type="search"], input[lzField]') as HTMLInputElement;
    expect(el().querySelector(`label[for="${search.id}"]`) || search.getAttribute('aria-label')).toBeTruthy();
    search.value = 'person 03';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-table-scroll')).toBeNull();
  });

  it('opens the PTO dialog (lz-dialog-frame) from a >=48px Configure PTO button and closes it on Escape', async () => {
    await setup([person(1)]);
    const btn = el().querySelector('tbody button') as HTMLButtonElement;
    expect(btn.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(btn.getAttribute('aria-label')).toContain('Person 01');
    btn.click();
    fixture.detectChanges();
    expect(document.querySelector('lz-dialog-frame')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(document.querySelector('lz-dialog-frame')).toBeNull();
  });
});
