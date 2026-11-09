import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Location } from 'src/app/core/models/location.model';
import { ScheduleComponent } from './schedule.component';

describe('ScheduleComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<ScheduleComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const text = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScheduleComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: null }] }),
        { provide: ToastrService, useValue: { error: () => undefined, success: () => undefined } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ScheduleComponent);
    fixture.detectChanges();
  });

  it('uses lz-page-header with the location picker in the meta slot and no Bootstrap markup', () => {
    const header = root().querySelector('lz-page-header') as HTMLElement;
    expect(text(header.querySelector('h1'))).toBe('Schedule');
    const select = header.querySelector('[lzHeaderMeta] select') as HTMLSelectElement;
    expect(select.getAttribute('aria-label')).toBe('Location');
    expect(select.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(root().querySelector('.card, .card-header, .container-fluid, .form-control, .row')).toBeNull();
  });

  it('lists locations and keeps All locations first', () => {
    fixture.componentInstance.locations = [{ locationId: 3, name: 'HQ' } as Location];
    fixture.detectChanges();
    const options = Array.from(root().querySelectorAll('select option')).map(o => text(o));
    expect(options).toEqual(['All locations', 'HQ']);
  });

  it('shows loading and error through lz-alert', () => {
    fixture.componentInstance.loading = true;
    fixture.componentInstance.error = new Error('x');
    fixture.detectChanges();
    const alerts = Array.from(root().querySelectorAll('lz-alert'));
    expect(alerts.map(a => a.getAttribute('role'))).toEqual(['status', 'alert']);
    expect(text(alerts[1])).toContain('Error loading schedule');
    expect(root().querySelector('.spinner-border, .alert')).toBeNull();
  });
});
