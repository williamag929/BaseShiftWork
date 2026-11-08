import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { People } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { InviteService } from 'src/app/core/services/invite.service';
import { RoleService } from 'src/app/core/services/role.service';
import { PlanLimitPromptService } from 'src/app/core/services/plan-limit-prompt.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { MatIconModule } from '@angular/material/icon';
import { LzButtonDirective, LzPageHeaderComponent, LzStatusChipComponent } from 'src/app/shared/ui';
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

  async function setup(people: People[]) {
    await TestBed.configureTestingModule({
      declarations: [PeopleComponent],
      imports: [ReactiveFormsModule, MatIconModule, LzButtonDirective, LzPageHeaderComponent, LzStatusChipComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: company }] }),
        { provide: PeopleService, useValue: { getPeople: () => of(people) } },
        { provide: RoleService, useValue: { getRoles: () => of([]) } },
        { provide: InviteService, useValue: { getInviteStatus: () => of({ status: 'None' }) } },
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
    expect(primary.length).toBe(1);
    expect(primary[0].textContent).toContain('Invite people');
  });

  it('primary action resets the form for a new person', async () => {
    await setup([person()]);
    fixture.componentInstance.editPerson(person());
    (el().querySelector('[variant="primary"]') as HTMLButtonElement).click();
    expect(fixture.componentInstance.selectedPerson).toBeNull();
  });

  it('status column uses lz-status-chip', async () => {
    await setup([person(), person({ personId: 2, name: 'Bo Li', email: 'bo@example.com', statusShiftWork: 'OffShift' })]);
    const rows = el().querySelectorAll('tbody tr');
    const on = rows[0].querySelector('td:nth-child(4) lz-status-chip span')!;
    expect(on.classList.contains('bg-success-bg')).toBeTrue();
    expect(on.textContent).toContain('On shift');
    const off = rows[1].querySelector('td:nth-child(4) lz-status-chip span')!;
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
    expect(el().querySelector('[aria-label="More actions for Ana Ruiz"]')).not.toBeNull();
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
});
