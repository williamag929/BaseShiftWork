import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { Observable, of, throwError } from 'rxjs';
import { TaskShift } from 'src/app/core/models/task-shift.model';
import { TaskShiftService } from 'src/app/core/services/task-shift.service';
import { LocationService } from 'src/app/core/services/location.service';
import { AreaService } from 'src/app/core/services/area.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { TasksComponent } from './tasks.component';

describe('TasksComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<TasksComponent>;
  let service: Record<string, jasmine.Spy>;
  let toastr: Record<string, jasmine.Spy>;
  const el = () => fixture.nativeElement as HTMLElement;
  const task = (id: number, extra: Partial<TaskShift> = {}): TaskShift => ({
    taskShiftId: id, title: `Task ${id}`, description: `Do thing ${id}`, companyId: 'c1', locationId: 7, status: 'Active', ...extra,
  });
  const many = (n: number) => Array.from({ length: n }, (_, i) => task(i + 1));
  const panel = () => document.querySelector('lz-side-panel [role="dialog"]') as HTMLElement | null;

  async function setup(tasks: TaskShift[] | Observable<TaskShift[]>) {
    service = {
      getTaskShifts: jasmine.createSpy('getTaskShifts').and.returnValue(Array.isArray(tasks) ? of(tasks) : tasks),
      createTaskShift: jasmine.createSpy('createTaskShift').and.callFake((_c: string, t: TaskShift) => of({ ...t, taskShiftId: 99 })),
      updateTaskShift: jasmine.createSpy('updateTaskShift').and.callFake((_c: string, _id: number, t: TaskShift) => of(t)),
    };
    toastr = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
    TestBed.configureTestingModule({
      imports: [TasksComponent],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'c1' } }] }),
        { provide: TaskShiftService, useValue: service },
        { provide: LocationService, useValue: { getLocations: () => of([{ locationId: 7, name: 'HQ', companyId: 'c1' }]) } },
        { provide: AreaService, useValue: { getAreas: () => of([{ areaId: 3, name: 'Lobby', companyId: 'c1' }]) } },
        { provide: PeopleService, useValue: { getPeople: () => of([{ personId: 5, name: 'Alex Guard' }]) } },
        { provide: AuthService, useValue: {} },
        { provide: ToastrService, useValue: toastr },
      ],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TasksComponent);
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
    await setup([task(1)]);
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Tasks');
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el().querySelector('[variant="primary"]')!.textContent).toContain('Add task');
    expect(el().querySelector('i.fa, .panel-card, .btn, .btn-submit')).toBeNull();
  });

  it('the header add button becomes secondary while the panel is open', async () => {
    await setup([task(1)]);
    await click(el().querySelector('lz-page-header button'));
    expect(el().querySelector('lz-page-header button')!.getAttribute('variant')).toBe('secondary');
    expect(document.querySelectorAll('[variant="primary"]').length).toBe(1);
  });

  it('lists tasks in lz-table-scroll with names resolved and status text', async () => {
    await setup([task(1, { areaId: 3, personId: 5 }), task(2, { status: 'Inactive' })]);
    expect(el().querySelector('lz-table-scroll table')).not.toBeNull();
    el().querySelectorAll('thead th').forEach(th => expect(th.getAttribute('scope')).toBe('col'));
    const first = el().querySelector('tbody tr')!.textContent!;
    expect(first).toContain('Task 1');
    expect(first).toContain('Do thing 1');
    expect(first).toContain('HQ');
    expect(first).toContain('Lobby');
    expect(first).toContain('Alex Guard');
    expect(Array.from(el().querySelectorAll('lz-status-chip')).map(c => c.textContent!.trim())).toEqual(['Active', 'Inactive']);
    expect(el().querySelector('[aria-label="Edit Task 1"]')).not.toBeNull();
  });

  it('shows lz-empty-state and no table when there are no tasks', async () => {
    await setup([]);
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-table-scroll')).toBeNull();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
  });

  it('shows only an lz-alert, not the empty state, when loading fails', async () => {
    await setup(throwError(() => new Error('boom')));
    expect(el().querySelector('lz-alert[role="alert"]')!.textContent).toContain('Error loading tasks');
    expect(el().querySelector('lz-empty-state')).toBeNull();
  });

  it('renders no form until the panel opens', async () => {
    await setup([task(1)]);
    expect(el().querySelector('form')).toBeNull();
    expect(document.querySelector('form')).toBeNull();
    await click(el().querySelector('lz-page-header button'));
    expect(panel()!.querySelector('form')).not.toBeNull();
    expect(panel()!.querySelector('h2')!.textContent).toContain('Add task');
  });

  it('marks only the truly required fields with a visible asterisk', async () => {
    await setup([]);
    await click(el().querySelector('lz-page-header button'));
    for (const id of ['title', 'description', 'locationId']) {
      expect(panel()!.querySelector(`lz-field label[for="${id}"]`)!.textContent).toContain('*');
      expect(panel()!.querySelector(`#${id}`)!.getAttribute('aria-required')).toBe('true');
    }
    for (const id of ['areaId', 'personId', 'status']) {
      expect(panel()!.querySelector(`lz-field label[for="${id}"]`)!.textContent).not.toContain('*');
    }
  });

  it('renders only 25 rows of 120 and pages forward', async () => {
    await setup(many(120));
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
    expect(el().querySelector('lz-pager')!.textContent).toContain('1–25 of 120');
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(el().querySelector('tbody tr')!.textContent).toContain('Task 26');
  });

  it('clamps the page when a reload returns fewer tasks', async () => {
    await setup(many(26));
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
    service['getTaskShifts'].and.returnValue(of(many(25)));
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectActiveCompany, { companyId: 'c1' } as any);
    store.refreshState();
    await settle();
    expect(fixture.componentInstance.page).toBe(1);
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
  });

  it('clicking a row opens the panel with its values and the action button does not double-fire', async () => {
    await setup([task(1, { areaId: 3 })]);
    const opened = spyOn(fixture.componentInstance, 'editTask').and.callThrough();
    await click(el().querySelector('[aria-label="Edit Task 1"]'));
    expect(opened).toHaveBeenCalledTimes(1);
    expect(panel()!.querySelector('h2')!.textContent).toContain('Task 1');
    expect((panel()!.querySelector('#title') as HTMLInputElement).value).toBe('Task 1');
    expect((panel()!.querySelector('#areaId') as HTMLSelectElement).value).toBe('3');
  });

  it('creating a task without an area sends numeric ids and null for empty ones, then toasts and closes', async () => {
    await setup([]);
    await click(el().querySelector('lz-page-header button'));
    expect(panel()!.querySelector('button[type="submit"]')!.hasAttribute('disabled')).toBeTrue();
    await type(panel()!, '#title', 'Mop');
    await type(panel()!, '#description', 'Mop the lobby');
    await choose(panel()!, '#locationId', '7');
    await click(panel()!.querySelector('button[type="submit"]'));
    const sent = service['createTaskShift'].calls.mostRecent().args[1];
    expect(sent.title).toBe('Mop');
    expect(sent.locationId).toBe(7);
    expect(sent.areaId).toBeNull();
    expect(sent.personId).toBeNull();
    expect(toastr['success']).toHaveBeenCalledWith('Task created.');
    expect(panel()).toBeNull();
    expect(el().querySelector('tbody')!.textContent).toContain('Mop');
  });

  it('a failed create shows a localized error toast, keeps the panel open and re-enables saving', async () => {
    await setup([]);
    service['createTaskShift'].and.returnValue(throwError(() => new Error('boom')));
    await click(el().querySelector('lz-page-header button'));
    await type(panel()!, '#title', 'Mop');
    await type(panel()!, '#description', 'Mop the lobby');
    await choose(panel()!, '#locationId', '7');
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(toastr['error']).toHaveBeenCalledWith('Could not create the task.');
    expect(panel()).not.toBeNull();
    expect(fixture.componentInstance.saving).toBeFalse();
  });

  it('a failed update shows a localized error toast', async () => {
    await setup([task(1)]);
    service['updateTaskShift'].and.returnValue(throwError(() => new Error('boom')));
    await click(el().querySelector('tbody tr'));
    await type(panel()!, '#title', 'Renamed');
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(toastr['error']).toHaveBeenCalledWith('Could not update the task.');
    expect(panel()).not.toBeNull();
  });

  it('shows a required message with an alert role once the title is touched and empty', async () => {
    await setup([]);
    await click(el().querySelector('lz-page-header button'));
    const title = panel()!.querySelector('#title') as HTMLInputElement;
    title.dispatchEvent(new Event('blur'));
    await settle();
    expect(panel()!.querySelector('#title-error')!.textContent).toContain('Task title is required');
    expect(panel()!.querySelector('#title-error')!.getAttribute('role')).toBe('alert');
    expect(title.getAttribute('aria-invalid')).toBe('true');
  });

  it('saving an edit is disabled until the form changes, then updates', async () => {
    await setup([task(1)]);
    await click(el().querySelector('tbody tr'));
    const submit = panel()!.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBeTrue();
    await type(panel()!, '#title', 'Renamed');
    expect(submit.disabled).toBeFalse();
    await click(submit);
    expect(service['updateTaskShift']).toHaveBeenCalled();
    expect(toastr['success']).toHaveBeenCalledWith('Task updated.');
  });

  it('closing a dirty panel asks to discard instead of closing', async () => {
    await setup([task(1)]);
    await click(el().querySelector('lz-page-header button'));
    await type(panel()!, '#title', 'x');
    await click(panel()!.querySelector('[aria-label="Close"]'));
    expect(panel()!.textContent).toContain('Discard your changes?');
  });

  it('closing the panel restores focus to the opener', async () => {
    await setup([task(1)]);
    const opener = el().querySelector('[aria-label="Edit Task 1"]') as HTMLElement;
    opener.focus();
    await click(opener);
    await click(panel()!.querySelector('[aria-label="Close"]'));
    await settle();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps row action and form control targets at 48px', async () => {
    await setup([task(1)]);
    const button = el().querySelector('[aria-label="Edit Task 1"]') as HTMLElement;
    expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(48);
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    await click(button);
    for (const field of Array.from(panel()!.querySelectorAll('input[lzField], select[lzField], textarea[lzField]'))) {
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
