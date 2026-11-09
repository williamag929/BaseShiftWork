import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon';
import { provideMockStore } from '@ngrx/store/testing';
import { Observable, of, throwError } from 'rxjs';
import { Crew } from 'src/app/core/models/crew.model';
import { CrewService } from 'src/app/core/services/crew.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import {
  LzAlertComponent, LzButtonDirective, LzDialogFrameComponent, LzDialogOverlayComponent, LzEmptyStateComponent, LzFieldComponent,
  LzFieldDirective, LzPageHeaderComponent, LzPagerComponent, LzSidePanelComponent, LzTableDirective, LzTableScrollComponent,
} from 'src/app/shared/ui';
import { CrewsComponent } from './crews.component';

describe('CrewsComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<CrewsComponent>;
  let service: Record<string, jasmine.Spy>;
  const el = () => fixture.nativeElement as HTMLElement;
  const crew = (id: number, name = `Crew ${id}`): Crew => ({ crewId: id, name, companyId: 'c1' });
  const many = (n: number) => Array.from({ length: n }, (_, i) => crew(i + 1));
  const panel = () => document.querySelector('lz-side-panel [role="dialog"]') as HTMLElement | null;

  async function setup(crews: Crew[] | Observable<Crew[]>) {
    service = {
      getCrews: jasmine.createSpy('getCrews').and.returnValue(Array.isArray(crews) ? of(crews) : crews),
      getCrewMembers: jasmine.createSpy('getCrewMembers').and.returnValue(of([{ personId: 1, name: 'Ana Ruiz' }])),
      createCrew: jasmine.createSpy('createCrew').and.callFake((_c: string, name: string) => of(crew(99, name))),
      updateCrew: jasmine.createSpy('updateCrew').and.returnValue(of(undefined)),
      deleteCrew: jasmine.createSpy('deleteCrew').and.returnValue(of(undefined)),
      addPersonToCrew: jasmine.createSpy('addPersonToCrew').and.returnValue(of(undefined)),
      removePersonFromCrew: jasmine.createSpy('removePersonFromCrew').and.returnValue(of(undefined)),
    };
    await TestBed.configureTestingModule({
      declarations: [CrewsComponent],
      imports: [
        ReactiveFormsModule, MatIconModule, LzButtonDirective, LzPageHeaderComponent, LzSidePanelComponent, LzPagerComponent,
        LzFieldComponent, LzFieldDirective, LzAlertComponent, LzEmptyStateComponent, LzTableDirective, LzTableScrollComponent,
        LzDialogOverlayComponent, LzDialogFrameComponent,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'c1' } }] }),
        { provide: CrewService, useValue: service },
        { provide: PeopleService, useValue: { getPeople: () => of([{ personId: 1, name: 'Ana Ruiz' }, { personId: 2, name: 'Bo Li' }]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CrewsComponent);
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

  it('renders one h1 through lz-page-header and exactly one primary button', async () => {
    await setup([crew(1)]);
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Crews');
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el().querySelector('[variant="primary"]')!.textContent).toContain('Add crew');
    expect(el().querySelector('i.fa, .panel-card, .btn')).toBeNull();
  });

  it('lists crews in lz-table-scroll with scoped headers and accessible row actions', async () => {
    await setup([crew(1, 'Night crew')]);
    expect(el().querySelector('lz-table-scroll table')).not.toBeNull();
    el().querySelectorAll('thead th').forEach(th => expect(th.getAttribute('scope')).toBe('col'));
    expect(el().querySelector('[aria-label="Edit Night crew"]')).not.toBeNull();
    expect(el().querySelector('[aria-label="Delete Night crew"]')).not.toBeNull();
  });

  it('shows lz-empty-state and no table when there are no crews', async () => {
    await setup([]);
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-table-scroll')).toBeNull();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
  });

  it('shows an lz-alert when loading fails', async () => {
    await setup(throwError(() => new Error('boom')));
    expect(el().querySelector('lz-alert[role="alert"]')!.textContent).toContain('Failed to load crews.');
  });

  it('renders no form until the panel opens', async () => {
    await setup([crew(1)]);
    expect(el().querySelector('form')).toBeNull();
    expect(document.querySelector('form')).toBeNull();
    await click(el().querySelector('lz-page-header button'));
    expect(panel()!.querySelector('form')).not.toBeNull();
    expect(panel()!.querySelector('h2')!.textContent).toContain('Add crew');
  });

  it('renders only 25 rows of 120 and pages forward', async () => {
    await setup(many(120));
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
    expect(el().querySelector('lz-pager')!.textContent).toContain('1–25 of 120');
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(el().querySelector('tbody tr')!.textContent).toContain('Crew 26');
  });

  it('clicking a row opens the panel titled with the crew name and its members', async () => {
    await setup([crew(1, 'Night crew')]);
    await click(el().querySelector('tbody tr'));
    expect(panel()!.querySelector('h2')!.textContent).toContain('Night crew');
    expect((panel()!.querySelector('#crew-name') as HTMLInputElement).value).toBe('Night crew');
    expect(service['getCrewMembers']).toHaveBeenCalledWith('c1', 1);
    expect(panel()!.textContent).toContain('Ana Ruiz');
    const options = Array.from(panel()!.querySelectorAll('#crew-add-person option')).map(o => o.textContent!.trim());
    expect(options).toEqual(['Select a person', 'Bo Li']);
  });

  it('creating a crew calls the service and keeps the panel open on the new crew', async () => {
    await setup([]);
    await click(el().querySelector('lz-page-header button'));
    const input = panel()!.querySelector('#crew-name') as HTMLInputElement;
    input.value = 'Day crew';
    input.dispatchEvent(new Event('input'));
    await settle();
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(service['createCrew']).toHaveBeenCalledWith('c1', 'Day crew');
    expect(panel()!.querySelector('h2')!.textContent).toContain('Day crew');
  });

  it('adds and removes members from the panel', async () => {
    await setup([crew(1)]);
    await click(el().querySelector('tbody tr'));
    const select = panel()!.querySelector('#crew-add-person') as HTMLSelectElement;
    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change'));
    await settle();
    await click(Array.from(panel()!.querySelectorAll('button')).find(b => b.textContent!.trim() === 'Add')!);
    expect(service['addPersonToCrew']).toHaveBeenCalledWith('c1', 1, 2);
    await click(panel()!.querySelector('[aria-label="Remove Ana Ruiz from crew"]'));
    expect(service['removePersonFromCrew']).toHaveBeenCalledWith('c1', 1, 1);
  });

  it('closing a dirty panel asks to discard instead of closing', async () => {
    await setup([crew(1)]);
    await click(el().querySelector('lz-page-header button'));
    const input = panel()!.querySelector('#crew-name') as HTMLInputElement;
    input.value = 'x';
    input.dispatchEvent(new Event('input'));
    await settle();
    await click(panel()!.querySelector('[aria-label="Close"]'));
    expect(panel()!.textContent).toContain('Discard your changes?');
  });

  it('deleting asks in an alertdialog and only deletes after confirming', async () => {
    await setup([crew(1, 'Night crew')]);
    await click(el().querySelector('[aria-label="Delete Night crew"]'));
    const dialog = document.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Delete Night crew?');
    expect(service['deleteCrew']).not.toHaveBeenCalled();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    await click(Array.from(dialog.querySelectorAll('button')).find(b => b.textContent!.includes('Delete crew'))!);
    expect(service['deleteCrew']).toHaveBeenCalledWith('c1', 1);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('keeps row action targets at 48px', async () => {
    await setup([crew(1)]);
    const button = el().querySelector('[aria-label="Edit Crew 1"]') as HTMLElement;
    const box = button.getBoundingClientRect();
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
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
