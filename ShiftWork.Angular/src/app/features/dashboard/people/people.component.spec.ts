import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subject, of } from 'rxjs';
import { People } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { InviteService } from 'src/app/core/services/invite.service';
import { RoleService } from 'src/app/core/services/role.service';
import { PlanLimitPromptService } from 'src/app/core/services/plan-limit-prompt.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { MatIconModule } from '@angular/material/icon';
import {
  LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzFieldComponent, LzFieldDirective, LzPageHeaderComponent,
  LzPagerComponent, LzSidePanelComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent,
} from 'src/app/shared/ui';
import { PeopleComponent } from './people.component';

describe('PeopleComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<PeopleComponent>;
  const company = { companyId: 'c1' };

  const person = (overrides: Partial<People> = {}): People => ({
    personId: 1,
    name: 'Ana Ruiz',
    companyId: 'c1',
    email: 'ana@example.com',
    status: 'Active',
    statusShiftWork: 'OnShift',
    ...overrides,
  });

  let peopleService: { getPeople: jasmine.Spy; updatePersonStatus: jasmine.Spy };

  async function setup(people: People[], invite: { getInviteStatus: (...a: any[]) => any } = { getInviteStatus: () => of({ status: 'None' }) }) {
    peopleService = {
      getPeople: jasmine.createSpy('getPeople').and.returnValue(of(people)),
      updatePersonStatus: jasmine.createSpy('updatePersonStatus').and.returnValue(of(undefined)),
    };
    await TestBed.configureTestingModule({
      declarations: [PeopleComponent],
      imports: [
        ReactiveFormsModule, MatIconModule, LzButtonDirective, LzPageHeaderComponent, LzStatusChipComponent,
        LzSidePanelComponent, LzPagerComponent, LzFieldComponent, LzFieldDirective, LzAlertComponent,
        LzEmptyStateComponent, LzTableDirective, LzTableScrollComponent,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: company }] }),
        { provide: PeopleService, useValue: peopleService },
        { provide: RoleService, useValue: { getRoles: () => of([]) } },
        { provide: InviteService, useValue: invite },
        { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['success', 'error', 'warning']) },
        { provide: PlanLimitPromptService, useValue: { handle: () => false } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PeopleComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;

  it('uses lz-page-header titled People with one primary action', async () => {
    await setup([person()]);
    const header = el().querySelector('lz-page-header')!;
    expect(header.querySelector('h1')!.textContent).toContain('People');
    const primary = el().querySelectorAll('[variant="primary"]');
    fixture.componentInstance.openInviteDialog(person());
    fixture.detectChanges();
    expect(el().querySelectorAll('[role="dialog"] [variant="primary"]').length).toBe(1);
    expect(Array.from(primary).filter(b => !b.closest('[role="dialog"]')).length).toBe(1);
    expect(primary[0].textContent).toContain('Add person');
  });

  it('primary action resets the form for a new person', async () => {
    await setup([person()]);
    fixture.componentInstance.selectedPerson = person();
    (el().querySelector('[variant="primary"]') as HTMLButtonElement).click();
    expect(fixture.componentInstance.selectedPerson).toBeNull();
  });

  it('status column uses lz-status-chip', async () => {
    await setup([person(), person({ personId: 2, name: 'Bo Li', email: 'bo@example.com', statusShiftWork: 'OffShift' })]);
    const rows = el().querySelectorAll('tbody tr');
    const on = rows[0].querySelector('td:nth-child(5) lz-status-chip span')!;
    expect(on.classList.contains('bg-success-bg')).toBeTrue();
    expect(on.textContent).toContain('On shift');
    const off = rows[1].querySelector('td:nth-child(5) lz-status-chip span')!;
    expect(off.classList.contains('bg-neutral-bg')).toBeTrue();
    expect(off.textContent).toContain('Off shift');
  });

  it('table header cells are th with scope="col"', async () => {
    await setup([person()]);
    const ths = el().querySelectorAll('thead th');
    expect(ths.length).toBeGreaterThan(0);
    ths.forEach(th => expect(th.getAttribute('scope')).toBe('col'));
  });

  it('row action button has an accessible name', async () => {
    await setup([person()]);
    expect(el().querySelector('[aria-label="Edit Ana Ruiz"]')).not.toBeNull();
  });

  describe('list and drawer', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => person({ personId: i + 1, name: `Person ${i + 1}`, email: `p${i + 1}@example.com` }));
    const click = (sel: string) => {
      (el().querySelector(sel) as HTMLElement).click();
      fixture.detectChanges();
    };
    const type = (input: HTMLInputElement, value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const panel = () => el().querySelector('lz-side-panel [role="dialog"]') as HTMLElement | null;
    const addPerson = async () => {
      (Array.from(el().querySelectorAll('lz-page-header button')).find(b => b.textContent!.includes('Add person')) as HTMLElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('renders no form before the drawer opens', async () => {
      await setup([person()]);
      expect(el().querySelector('form')).toBeNull();
      expect(panel()).toBeNull();
    });

    it('Add person opens the drawer with the form and focuses the name input', async () => {
      await setup([person()]);
      await addPerson();
      expect(panel()!.querySelector('form')).not.toBeNull();
      expect(panel()!.querySelector('h2')!.textContent).toContain('Add person');
      expect(document.activeElement).toBe(panel()!.querySelector('#name'));
    });

    it('clicking a row opens the drawer titled with the person name', async () => {
      await setup([person(), person({ personId: 2, name: 'Bo Li', email: 'bo@example.com' })]);
      (el().querySelectorAll('tbody tr')[1] as HTMLElement).click();
      fixture.detectChanges();
      expect(panel()!.querySelector('h2')!.textContent).toContain('Bo Li');
      expect((panel()!.querySelector('#name') as HTMLInputElement).value).toBe('Bo Li');
    });

    it('the row edit button opens the drawer too', async () => {
      await setup([person()]);
      click('[aria-label="Edit Ana Ruiz"]');
      expect(panel()!.querySelector('h2')!.textContent).toContain('Ana Ruiz');
    });

    it('renders only 25 rows per page and the pager reads 1–25 of 120', async () => {
      await setup(many(120));
      expect(el().querySelectorAll('tbody tr').length).toBe(25);
      expect(el().querySelector('lz-pager')!.textContent).toContain('1–25 of 120');
    });

    it('next page shows the following rows', async () => {
      await setup(many(120));
      click('lz-pager [aria-label="Next page"]');
      expect(el().querySelector('tbody tr')!.textContent).toContain('Person 26');
    });

    it('changing search or status resets to page 1', async () => {
      await setup(many(120));
      click('lz-pager [aria-label="Next page"]');
      expect(fixture.componentInstance.page).toBe(2);
      type(el().querySelector('input[type="search"]') as HTMLInputElement, 'person');
      expect(fixture.componentInstance.page).toBe(1);
      click('lz-pager [aria-label="Next page"]');
      const select = el().querySelector('select[aria-label="Status"]') as HTMLSelectElement;
      select.value = 'Active';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(fixture.componentInstance.page).toBe(1);
    });

    it('search text and page survive closing the drawer', async () => {
      await setup(many(120));
      type(el().querySelector('input[type="search"]') as HTMLInputElement, 'person');
      click('lz-pager [aria-label="Next page"]');
      (el().querySelector('tbody tr') as HTMLElement).click();
      fixture.detectChanges();
      fixture.componentInstance.cancelEdit();
      fixture.detectChanges();
      expect(panel()).toBeNull();
      expect(fixture.componentInstance.searchTerm).toBe('person');
      expect(fixture.componentInstance.page).toBe(2);
      expect((el().querySelector('input[type="search"]') as HTMLInputElement).value).toBe('person');
    });

    it('closing a dirty form asks to discard', async () => {
      await setup([person()]);
      await addPerson();
      type(panel()!.querySelector('#name') as HTMLInputElement, 'Zed');
      fixture.componentInstance.personForm.markAsDirty();
      fixture.detectChanges();
      (panel()!.querySelector('[aria-label="Close"]') as HTMLElement).click();
      fixture.detectChanges();
      expect(panel()!.textContent).toContain('Discard your changes?');
    });

    it('has exactly one primary button while closed and while open', async () => {
      await setup([person()]);
      expect(el().querySelectorAll('lzButton[variant="primary"], button[variant="primary"]').length).toBe(1);
      await addPerson();
      const primaries = el().querySelectorAll('button[variant="primary"]');
      expect(primaries.length).toBe(1);
      expect(panel()!.contains(primaries[0])).toBeTrue();
    });

    it('splits the form into Basics and a collapsed Address and app access section', async () => {
      await setup([person()]);
      click('[aria-label="Edit Ana Ruiz"]');
      const details = panel()!.querySelector('details') as HTMLDetailsElement;
      expect(details.querySelector('summary')!.textContent).toContain('Address and app access');
      expect(details.open).toBeFalse();
      expect(details.contains(panel()!.querySelector('#name'))).toBeFalse();
      expect(details.contains(panel()!.querySelector('#city'))).toBeTrue();
    });

    it('opens the extra section for a person who has address values, and when adding', async () => {
      await setup([person({ city: 'Queens' })]);
      click('[aria-label="Edit Ana Ruiz"]');
      expect((panel()!.querySelector('details') as HTMLDetailsElement).open).toBeTrue();
      fixture.componentInstance.cancelEdit();
      fixture.detectChanges();
      await addPerson();
      expect((panel()!.querySelector('details') as HTMLDetailsElement).open).toBeTrue();
    });

    it('selecting rows shows the selection bar; clear hides it', async () => {
      await setup([person(), person({ personId: 2, name: 'Bo Li', email: 'bo@example.com' })]);
      expect(el().textContent).not.toContain('selected');
      click('tbody tr:first-child input[type="checkbox"]');
      expect(fixture.componentInstance.selectedIds.has(1)).toBeTrue();
      expect(panel()).toBeNull();
      expect(el().textContent).toContain('1 selected');
      const clear = Array.from(el().querySelectorAll('button')).find(b => b.textContent!.trim() === 'Clear') as HTMLElement;
      clear.click();
      fixture.detectChanges();
      expect(el().textContent).not.toContain('selected');
    });

    it('row checkboxes have a hit area of at least 24px and an accessible name', async () => {
      await setup([person()]);
      const box = el().querySelector('tbody input[type="checkbox"]') as HTMLInputElement;
      const hit = box.closest('label')!.getBoundingClientRect();
      expect(hit.width).toBeGreaterThanOrEqual(24);
      expect(hit.height).toBeGreaterThanOrEqual(24);
      expect(box.getAttribute('aria-label')).toContain('Ana Ruiz');
    });

    it('Set inactive updates each selected person once, then reloads', async () => {
      await setup([person(), person({ personId: 2, name: 'Bo Li', email: 'bo@example.com' }), person({ personId: 3, name: 'Cy', email: 'cy@example.com' })]);
      click('tbody tr:nth-child(1) input[type="checkbox"]');
      click('tbody tr:nth-child(3) input[type="checkbox"]');
      const callsBefore = peopleService.getPeople.calls.count();
      const btn = Array.from(el().querySelectorAll('button')).find(b => b.textContent!.trim() === 'Set inactive') as HTMLElement;
      btn.click();
      fixture.detectChanges();
      expect(peopleService.updatePersonStatus.calls.allArgs()).toEqual([['c1', 1, 'Inactive'], ['c1', 3, 'Inactive']]);
      expect(peopleService.getPeople.calls.count()).toBe(callsBefore + 1);
      expect(fixture.componentInstance.selectedIds.size).toBe(0);
    });

    it('uses an empty state when there are no people at all', async () => {
      await setup([]);
      expect(el().querySelector('lz-empty-state')!.textContent).toContain('No people found');
    });

    it('uses lz-alert for errors', async () => {
      await setup([person()]);
      fixture.componentInstance.error = new Error('x');
      fixture.detectChanges();
      expect(el().querySelector('lz-alert')!.textContent).toContain('Error loading people');
    });

    it('table sits inside lz-table-scroll', async () => {
      await setup([person()]);
      expect(el().querySelector('lz-table-scroll table[lzTable]')).not.toBeNull();
      expect(el().querySelector('lz-side-panel')).not.toBeNull();
    });
  });

  it('search filters rows by name or email', async () => {
    await setup([person(), person({ personId: 2, name: 'Bo Li', email: 'bo@example.com' })]);
    const input = el().querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'bo li';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
    expect(el().querySelector('tbody')!.textContent).toContain('Bo Li');
  });

  it('loads up to 1000 people', async () => {
    await setup([person()]);
    expect(peopleService.getPeople).toHaveBeenCalledWith('c1', 1, 1000);
  });

  it('status filter narrows rows', async () => {
    await setup([person(), person({ personId: 2, name: 'Bo Li', email: 'bo@example.com', status: 'Inactive' })]);
    const select = el().querySelector('select[aria-label="Status"]') as HTMLSelectElement;
    select.value = 'Inactive';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
    expect(el().querySelector('tbody')!.textContent).toContain('Bo Li');
  });

  it('shows the On shift chip for OnShift:Late and no chip for a missing status', async () => {
    await setup([person({ statusShiftWork: 'OnShift:Late' }), person({ personId: 2, name: 'Bo Li', email: 'bo@example.com', statusShiftWork: undefined })]);
    const rows = el().querySelectorAll('tbody tr');
    expect(rows[0].querySelector('td:nth-child(5) lz-status-chip')!.textContent).toContain('On shift');
    expect(rows[1].querySelector('td:nth-child(5) lz-status-chip')).toBeNull();
  });

  it('shows a no-match message when the filter excludes everyone', async () => {
    await setup([person()]);
    const input = el().querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el().textContent).toContain('No people match your search');
    expect(el().textContent).not.toContain('Create your first team member');
  });

  it('caps concurrent invite-status requests at 6 and still records every result', async () => {
    const pending: Subject<any>[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const getInviteStatus = jasmine.createSpy('getInviteStatus').and.callFake(() => {
      const subject = new Subject<any>();
      pending.push(subject);
      return new Observable<any>(observer => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        const sub = subject.subscribe(observer);
        return () => {
          inFlight--;
          sub.unsubscribe();
        };
      });
    });
    const people = Array.from({ length: 10 }, (_, i) => person({ personId: i + 1, name: `P${i + 1}`, email: `p${i + 1}@example.com` }));
    await setup(people, { getInviteStatus });
    expect(inFlight).toBe(6);
    let next: Subject<any> | undefined;
    while ((next = pending.shift())) {
      next.next({ status: 'Pending' });
      next.complete();
    }
    expect(maxInFlight).toBe(6);
    expect(getInviteStatus).toHaveBeenCalledTimes(10);
    expect(fixture.componentInstance.getInviteStatus(10)?.status).toBe('Pending');
  });
});
