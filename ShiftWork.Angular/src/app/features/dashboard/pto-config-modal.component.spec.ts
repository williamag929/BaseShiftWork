import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { PtoService } from 'src/app/core/services/pto.service';
import { PtoConfigModalComponent } from './pto-config-modal.component';

describe('PtoConfigModalComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<PtoConfigModalComponent>;
  let pto: { getBalance: jasmine.Spy; configurePto: jasmine.Spy };
  let closed: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    pto = {
      getBalance: jasmine.createSpy('getBalance').and.returnValue(of({ balance: 12 })),
      configurePto: jasmine.createSpy('configurePto').and.returnValue(of({})),
    };
    await TestBed.configureTestingModule({
      imports: [PtoConfigModalComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: PtoService, useValue: pto },
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy('open') } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PtoConfigModalComponent);
    fixture.componentInstance.person = { personId: 7, name: 'Ana Ruiz', companyId: 'c1', email: 'a@b.c' };
    fixture.componentInstance.companyId = 'c1';
    closed = jasmine.createSpy('closed');
    fixture.componentInstance.close.subscribe(closed);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders as lz-dialog-overlay > lz-dialog-frame with a titled modal dialog', () => {
    const dialog = el().querySelector('lz-dialog-overlay [role="dialog"][aria-modal="true"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    const frame = dialog.querySelector('lz-dialog-frame')!;
    expect(frame).not.toBeNull();
    const heading = frame.querySelector('h2')!;
    expect(heading.textContent).toContain('Ana Ruiz');
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(el().querySelector('.modal-backdrop, .modal-content, .btn, .form-group')).toBeNull();
  });

  it('labels all three inputs and keeps controls >=48px', () => {
    ['accrualRate', 'startingBalance', 'startDate'].forEach(id => {
      const input = el().querySelector(`#${id}`) as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(el().querySelector(`label[for="${id}"]`)).not.toBeNull();
      expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    });
    expect(el().querySelector('lz-dialog-frame')!.textContent).toContain('12');
  });

  it('has exactly one primary button (Save) in the dialog actions', () => {
    const primaries = Array.from(el().querySelectorAll('button[lzButton]')).filter(b => b.classList.contains('bg-ink'));
    expect(primaries.length).toBe(1);
    expect(primaries[0].textContent).toContain('Save');
  });

  it('links a negative-value message to its input with aria-describedby and aria-invalid', () => {
    const input = el().querySelector('#accrualRate') as HTMLInputElement;
    input.value = '-3';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const alert = el().querySelector('[role="alert"]') as HTMLElement;
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('cannot be negative');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')!.split(' ')).toContain(alert.id);
    expect(alert.id).toBeTruthy();
  });

  it('describes each input by its hint', () => {
    const input = el().querySelector('#startingBalance') as HTMLInputElement;
    const ids = input.getAttribute('aria-describedby')!.split(' ');
    expect(ids.length).toBeGreaterThan(0);
    expect(document.getElementById(ids[0])!.textContent!.length).toBeGreaterThan(5);
  });

  it('Escape and the scrim close it; Save still calls configurePto', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toHaveBeenCalledTimes(1);
    (el().querySelector('[data-testid="scrim"]') as HTMLElement).click();
    expect(closed).toHaveBeenCalledTimes(2);
    const input = el().querySelector('#accrualRate') as HTMLInputElement;
    input.value = '10';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const save = Array.from(el().querySelectorAll('button[lzButton]')).find(b => b.classList.contains('bg-ink')) as HTMLButtonElement;
    save.click();
    expect(pto.configurePto).toHaveBeenCalled();
    expect(pto.configurePto.calls.mostRecent().args[2].accrualRatePerMonth).toBe(10);
  });

  it('stops listening for Escape once destroyed', () => {
    fixture.destroy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).not.toHaveBeenCalled();
  });
});
