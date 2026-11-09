import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { Observable, of, throwError } from 'rxjs';
import { Location } from 'src/app/core/models/location.model';
import { AuthService } from 'src/app/core/services/auth.service';
import { LocationService } from 'src/app/core/services/location.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import {
  LzAlertComponent, LzButtonDirective, LzDialogFrameComponent, LzDialogOverlayComponent, LzEmptyStateComponent, LzFieldComponent,
  LzFieldDirective, LzPageHeaderComponent, LzPagerComponent, LzSidePanelComponent, LzStatusChipComponent, LzTableDirective,
  LzTableScrollComponent,
} from 'src/app/shared/ui';
import { LocationsComponent } from './locations.component';

describe('LocationsComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<LocationsComponent>;
  let service: Record<string, jasmine.Spy>;
  let toastr: Record<string, jasmine.Spy>;
  const el = () => fixture.nativeElement as HTMLElement;
  const loc = (id: number, extra: Partial<Location> = {}): Location => ({
    locationId: id, name: `Site ${id}`, companyId: 'c1', address: `${id} Main St`, city: 'Queens', state: 'NY', zipCode: '11369',
    geoCoordinates: { latitude: 40.7, longitude: -73.9 }, ratioMax: 100, status: 'Active', ...extra,
  });
  const many = (n: number) => Array.from({ length: n }, (_, i) => loc(i + 1));
  const panel = () => document.querySelector('lz-side-panel [role="dialog"]') as HTMLElement | null;

  async function setup(locations: Location[] | Observable<Location[]>) {
    service = {
      getLocations: jasmine.createSpy('getLocations').and.returnValue(Array.isArray(locations) ? of(locations) : locations),
      createLocation: jasmine.createSpy('createLocation').and.callFake((_c: string, l: Location) => of({ ...l, locationId: 99 })),
      updateLocation: jasmine.createSpy('updateLocation').and.callFake((_c: string, _id: number, l: Location) => of(l)),
      regenerateNfcTag: jasmine.createSpy('regenerateNfcTag').and.returnValue(of({ nfcTagKey: 'new-key', nfcLastTappedAt: null })),
    };
    toastr = {
      success: jasmine.createSpy('success'), error: jasmine.createSpy('error'), info: jasmine.createSpy('info'),
    };
    await TestBed.configureTestingModule({
      declarations: [LocationsComponent],
      imports: [
        ReactiveFormsModule, MatIconModule, LzButtonDirective, LzPageHeaderComponent, LzSidePanelComponent, LzPagerComponent,
        LzFieldComponent, LzFieldDirective, LzAlertComponent, LzEmptyStateComponent, LzTableDirective, LzTableScrollComponent,
        LzDialogOverlayComponent, LzDialogFrameComponent, LzStatusChipComponent,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'c1' } }] }),
        { provide: LocationService, useValue: service },
        { provide: AuthService, useValue: {} },
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LocationsComponent);
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

  const dialogButton = (text: string) =>
    Array.from(document.querySelectorAll('[role="alertdialog"] button, [role="dialog"][aria-modal="true"] button'))
      .find(b => b.textContent!.trim() === text) as HTMLElement;

  afterEach(() => {
    delete (window as any).google;
  });

  it('renders one h1 through lz-page-header and exactly one primary button', async () => {
    await setup([loc(1)]);
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Location management');
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el().querySelector('[variant="primary"]')!.textContent).toContain('Add location');
    expect(el().querySelector('i.fa, .panel-card, .btn, .btn-submit')).toBeNull();
  });

  it('lists locations in lz-table-scroll with scoped headers, status text and accessible edit buttons', async () => {
    await setup([loc(1, { name: 'HQ' }), loc(2, { status: 'Inactive' })]);
    expect(el().querySelector('lz-table-scroll table')).not.toBeNull();
    el().querySelectorAll('thead th').forEach(th => expect(th.getAttribute('scope')).toBe('col'));
    expect(el().querySelector('[aria-label="Edit HQ"]')).not.toBeNull();
    const chips = Array.from(el().querySelectorAll('lz-status-chip')).map(c => c.textContent!.trim());
    expect(chips).toEqual(['Active', 'Inactive']);
  });

  it('shows lz-empty-state and no table when there are no locations', async () => {
    await setup([]);
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-table-scroll')).toBeNull();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
  });

  it('shows only an lz-alert, not the empty state, when loading fails', async () => {
    await setup(throwError(() => new Error('boom')));
    expect(el().querySelector('lz-alert[role="alert"]')!.textContent).toContain('Error loading locations');
    expect(el().querySelector('lz-empty-state')).toBeNull();
    expect(el().querySelector('lz-table-scroll')).toBeNull();
  });

  it('renders no form until the panel opens', async () => {
    await setup([loc(1)]);
    expect(el().querySelector('form')).toBeNull();
    expect(document.querySelector('form')).toBeNull();
    await click(el().querySelector('lz-page-header button'));
    expect(panel()!.querySelector('form')).not.toBeNull();
    expect(panel()!.querySelector('h2')!.textContent).toContain('Add location');
  });

  it('renders only 25 rows of 120 and pages forward', async () => {
    await setup(many(120));
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
    expect(el().querySelector('lz-pager')!.textContent).toContain('1–25 of 120');
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(el().querySelector('tbody tr')!.textContent).toContain('Site 26');
  });

  it('clicking a row opens the panel titled with the location name and its values', async () => {
    await setup([loc(1, { name: 'HQ', externalCode: 'X1' })]);
    await click(el().querySelector('tbody tr'));
    expect(panel()!.querySelector('h2')!.textContent).toContain('HQ');
    expect((panel()!.querySelector('#name') as HTMLInputElement).value).toBe('HQ');
    expect((panel()!.querySelector('#latitude') as HTMLInputElement).value).toBe('40.7');
    expect(panel()!.querySelector('lz-field label[for="address"]')!.textContent).toContain('Street Address');
  });

  it('creating a location calls the service, shows a localized toast and closes the panel', async () => {
    await setup([]);
    await click(el().querySelector('lz-page-header button'));
    expect(panel()!.querySelector('button[type="submit"]')!.hasAttribute('disabled')).toBeTrue();
    await type(panel()!, '#name', 'Depot');
    await type(panel()!, '#address', '5 Dock Rd');
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(service['createLocation']).toHaveBeenCalled();
    expect(service['createLocation'].calls.mostRecent().args[1].name).toBe('Depot');
    expect(toastr['success']).toHaveBeenCalledWith('Location created.');
    expect(panel()).toBeNull();
    expect(el().querySelector('tbody')!.textContent).toContain('Depot');
  });

  it('a failed create shows a localized error toast and keeps the panel open', async () => {
    await setup([]);
    service['createLocation'].and.returnValue(throwError(() => new Error('boom')));
    await click(el().querySelector('lz-page-header button'));
    await type(panel()!, '#name', 'Depot');
    await type(panel()!, '#address', '5 Dock Rd');
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(toastr['error']).toHaveBeenCalledWith('Could not create the location.');
    expect(panel()).not.toBeNull();
  });

  it('saving an edit is disabled until the form changes, then updates', async () => {
    await setup([loc(1, { name: 'HQ' })]);
    await click(el().querySelector('tbody tr'));
    const submit = panel()!.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBeTrue();
    await type(panel()!, '#name', 'HQ 2');
    expect(submit.disabled).toBeFalse();
    await click(submit);
    expect(service['updateLocation']).toHaveBeenCalled();
    expect(toastr['success']).toHaveBeenCalledWith('Location updated.');
  });

  it('closing a dirty panel asks to discard instead of closing', async () => {
    await setup([loc(1)]);
    await click(el().querySelector('lz-page-header button'));
    await type(panel()!, '#name', 'x');
    await click(panel()!.querySelector('[aria-label="Close"]'));
    expect(panel()!.textContent).toContain('Discard your changes?');
  });

  it('closing the panel restores focus to the opener', async () => {
    await setup([loc(1, { name: 'HQ' })]);
    const opener = el().querySelector('[aria-label="Edit HQ"]') as HTMLElement;
    opener.focus();
    await click(opener);
    expect(panel()).not.toBeNull();
    await click(panel()!.querySelector('[aria-label="Close"]'));
    await settle();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  describe('map dialog', () => {
    beforeEach(() => {
      (window as any).google = {
        maps: {
          importLibrary: () => new Promise(() => undefined),
          event: { clearInstanceListeners: () => undefined },
          places: { Autocomplete: class { addListener() { return undefined; } } },
        },
      };
    });

    async function openMap() {
      await click(el().querySelector('lz-page-header button'));
      const trigger = Array.from(panel()!.querySelectorAll('button')).find(b => b.textContent!.includes('Set location on map'))!;
      trigger.focus();
      await click(trigger);
      return trigger;
    }

    it('opens in lz-dialog-overlay with a map container that keeps an explicit height', async () => {
      await setup([]);
      await openMap();
      const dialog = document.querySelector('lz-dialog-overlay [role="dialog"]') as HTMLElement;
      expect(dialog.textContent).toContain('Select location');
      const container = dialog.querySelector('[data-testid="map-container"]') as HTMLElement;
      expect(container.classList.contains('h-80')).toBeTrue();
      expect(getComputedStyle(container).height).toBe('320px');
      expect(container.getBoundingClientRect().height).toBeGreaterThanOrEqual(320);
      expect(dialog.querySelector('google-map')).not.toBeNull();
    });

    it('Cancel and Escape close the dialog and return focus to the map button', async () => {
      await setup([]);
      const trigger = await openMap();
      await click(dialogButton('Cancel'));
      expect(document.querySelector('lz-dialog-overlay')).toBeNull();
      await settle();
      expect(document.activeElement).toBe(trigger);
      await click(trigger);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(document.querySelector('lz-dialog-overlay')).toBeNull();
      expect(panel()).not.toBeNull();
    });

    it('a map click marks the form dirty so closing the panel asks to discard', async () => {
      await setup([]);
      await openMap();
      fixture.componentInstance.onMapClick({ latLng: { toJSON: () => ({ lat: 1, lng: 2 }) } } as any);
      await settle();
      await click(dialogButton('Confirm Location'));
      await click(panel()!.querySelector('[aria-label="Close"]'));
      expect(panel()!.textContent).toContain('Discard your changes?');
    });
  });

  describe('NFC tag', () => {
    it('asks in an alertdialog instead of window.confirm, and only regenerates after confirming', async () => {
      const confirmSpy = spyOn(window, 'confirm');
      await setup([loc(1, { name: 'HQ', nfcTagKey: 'old-key' })]);
      await click(el().querySelector('tbody tr'));
      const trigger = Array.from(panel()!.querySelectorAll('button')).find(b => b.textContent!.trim() === 'Regenerate')!;
      trigger.focus();
      await click(trigger);
      const dialog = document.querySelector('[role="alertdialog"]') as HTMLElement;
      expect(dialog.textContent).toContain('The current tag stops working right away');
      expect(service['regenerateNfcTag']).not.toHaveBeenCalled();
      await click(dialogButton('Cancel'));
      expect(document.querySelector('[role="alertdialog"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      await click(trigger);
      await click(dialogButton('Create new link'));
      expect(service['regenerateNfcTag']).toHaveBeenCalledWith('c1', 1);
      expect(toastr['success']).toHaveBeenCalledWith('New tag link ready. Write it to the tag.');
      expect(confirmSpy).not.toHaveBeenCalled();
      await settle();
      expect(document.activeElement).toBe(trigger);
    });

    it('Escape closes the confirmation without regenerating', async () => {
      await setup([loc(1, { name: 'HQ', nfcTagKey: 'old-key' })]);
      await click(el().querySelector('tbody tr'));
      await click(Array.from(panel()!.querySelectorAll('button')).find(b => b.textContent!.trim() === 'Regenerate')!);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(document.querySelector('[role="alertdialog"]')).toBeNull();
      expect(service['regenerateNfcTag']).not.toHaveBeenCalled();
      expect(panel()).not.toBeNull();
    });

    it('creates the first tag link without a confirmation', async () => {
      await setup([loc(1, { name: 'HQ' })]);
      await click(el().querySelector('tbody tr'));
      await click(Array.from(panel()!.querySelectorAll('button')).find(b => b.textContent!.trim() === 'Create tag link')!);
      expect(document.querySelector('[role="alertdialog"]')).toBeNull();
      expect(service['regenerateNfcTag']).toHaveBeenCalledWith('c1', 1);
      expect((panel()!.querySelector('#nfcTagUrl') as HTMLInputElement).value).toContain('new-key');
    });

    it('tells new locations to save first', async () => {
      await setup([]);
      await click(el().querySelector('lz-page-header button'));
      expect(panel()!.textContent).toContain('Save the location first');
    });
  });

  it('keeps row action and form control targets at 48px', async () => {
    await setup([loc(1)]);
    const button = el().querySelector('[aria-label="Edit Site 1"]') as HTMLElement;
    expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(48);
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    await click(button);
    for (const id of ['requirePin', 'requirePhoto', 'requireNfc']) {
      const input = panel()!.querySelector(`#${id}`) as HTMLElement;
      expect(input.getBoundingClientRect().width).toBeGreaterThanOrEqual(20);
      const hit = input.closest('label')!.getBoundingClientRect();
      expect(hit.width).toBeGreaterThanOrEqual(24);
      expect(hit.height).toBeGreaterThanOrEqual(48);
    }
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
