import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideMockStore } from '@ngrx/store/testing';
import { Subject, of, throwError } from 'rxjs';

import { PinDialogComponent } from './pin-dialog.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { SettingsHelperService } from 'src/app/core/services/settings-helper.service';

describe('PinDialogComponent', () => {
  let dialog: MatDialog;
  let ref: MatDialogRef<PinDialogComponent>;
  let opener: HTMLButtonElement;
  let verifyPin: jasmine.Spy;
  let pinLength: number;

  const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector(selector) as T;
  const qa = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector));
  const input = () => q<HTMLInputElement>('#kiosk-pin');
  const press = (digit: string) => qa('[data-testid="pin-key"]').find(k => k.textContent?.trim() === digit)!.click();
  const flush = async () => {
    await Promise.resolve();
    await new Promise(r => setTimeout(r, 0));
    TestBed.inject(ApplicationRef).tick();
  };

  async function open(config: { width?: string } = {}): Promise<void> {
    ref = dialog.open(PinDialogComponent, {
      width: config.width ?? '24rem',
      maxWidth: '95vw',
      panelClass: 'lz-dialog-surface',
      data: { name: 'Ana Perez', personId: 7, companyId: 'co-1' },
    });
    await flush();
  }

  beforeEach(() => {
    pinLength = 4;
    verifyPin = jasmine.createSpy('verifyPin').and.returnValue(of({ verified: true }));
    TestBed.configureTestingModule({
      imports: [PinDialogComponent],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ initialState: { activeCompany: 'co-1' } }),
        { provide: AuthService, useValue: { verifyPin } },
        {
          provide: SettingsHelperService,
          useValue: { loadSettings: () => of({}), getKioskPinLength: () => pinLength },
        },
      ],
    });
    dialog = TestBed.inject(MatDialog);
    opener = document.createElement('button');
    opener.textContent = 'Open';
    document.body.appendChild(opener);
    opener.focus();
  });

  afterEach(async () => {
    dialog.closeAll();
    await flush();
    opener.remove();
  });

  it('renders inside lz-dialog-frame with a close button and one heading', async () => {
    await open();
    const frame = q('app-pin-dialog lz-dialog-frame');
    expect(frame).not.toBeNull();
    expect(frame.querySelector('button[aria-label="Close"]')).not.toBeNull();
    expect(frame.querySelector('h2')!.textContent).toContain('Ana Perez');
    expect(qa('app-pin-dialog h1').length).toBe(0);
  });

  it('uses buttons for every keypad key with 64px minimum targets', async () => {
    await open();
    const keys = qa('[data-testid="pin-key"], [data-testid="pin-clear"], [data-testid="pin-backspace"]');
    expect(keys.length).toBe(12);
    for (const key of keys) {
      expect(key.tagName).toBe('BUTTON');
      expect(key.getAttribute('type')).toBe('button');
      const style = getComputedStyle(key);
      expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(64);
      expect(parseFloat(style.minWidth)).toBeGreaterThanOrEqual(64);
      const box = key.getBoundingClientRect();
      expect(box.width).toBeGreaterThanOrEqual(64);
      expect(box.height).toBeGreaterThanOrEqual(64);
    }
  });

  it('keeps primary actions at 56px and the dialog free of horizontal overflow', async () => {
    await open();
    const actions = qa('[lzDialogActions] button');
    expect(actions.length).toBe(2);
    for (const button of actions) {
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(56);
    }
    const pane = q('.cdk-overlay-pane');
    expect(pane.scrollWidth).toBeLessThanOrEqual(pane.clientWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });

  it('has exactly one primary button', async () => {
    await open();
    const primary = qa('app-pin-dialog button').filter(b => b.getAttribute('variant') === 'primary' || b.classList.contains('bg-ink'));
    expect(primary.length).toBe(1);
  });

  it('applies the Loqzen dialog radius to the Material surface', async () => {
    await open();
    const surface = q('.mat-mdc-dialog-surface');
    expect(getComputedStyle(surface).borderTopLeftRadius).toBe('12px');
  });

  it('fills, deletes and clears digits from the keypad and stops at the PIN length', async () => {
    await open();
    ['1', '2', '3', '4', '5'].forEach(press);
    expect(input().value).toBe('1234');
    q('[data-testid="pin-backspace"]').click();
    expect(input().value).toBe('123');
    q('[data-testid="pin-clear"]').click();
    expect(input().value).toBe('');
  });

  it('still accepts physical keyboard entry and submits through the form', async () => {
    await open();
    const field = input();
    field.value = '4321';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(field.getAttribute('inputmode')).toBe('none');
    q<HTMLFormElement>('#kiosk-pin-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    expect(verifyPin).toHaveBeenCalledWith('co-1', 7, '4321');
  });

  it('closes with true when the PIN is verified', async () => {
    await open();
    const result = jasmine.createSpy('result');
    ref.afterClosed().subscribe(result);
    ['1', '2', '3', '4'].forEach(press);
    qa('[lzDialogActions] button')[1].click();
    await flush();
    expect(result).toHaveBeenCalledWith(true);
  });

  it('shows a danger lz-alert with role=alert for a wrong PIN and keeps the dialog open', async () => {
    verifyPin.and.returnValue(of({ verified: false }));
    await open();
    ['1', '2', '3', '4'].forEach(press);
    qa('[lzDialogActions] button')[1].click();
    await flush();
    const alert = q('app-pin-dialog lz-alert');
    expect(alert).not.toBeNull();
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.className).toContain('bg-danger-bg');
    expect(alert.textContent).toContain('Invalid PIN');
    expect(input().value).toBe('');
    expect(q('app-pin-dialog')).not.toBeNull();
  });

  it('clears the alert when the next digit is entered', async () => {
    verifyPin.and.returnValue(of({ verified: false }));
    await open();
    ['1', '2', '3', '4'].forEach(press);
    qa('[lzDialogActions] button')[1].click();
    await flush();
    press('1');
    await flush();
    expect(q('app-pin-dialog lz-alert')).toBeNull();
  });

  it('explains rate limiting with the same alert', async () => {
    verifyPin.and.returnValue(throwError(() => ({ status: 429 })));
    await open();
    ['1', '2', '3', '4'].forEach(press);
    qa('[lzDialogActions] button')[1].click();
    await flush();
    expect(q('app-pin-dialog lz-alert[role="alert"]').textContent).toContain('Too many attempts');
  });

  it('disables Submit until the PIN is complete and while verifying', async () => {
    const pending = new Subject<{ verified: boolean }>();
    verifyPin.and.returnValue(pending);
    await open();
    const submit = qa('[lzDialogActions] button')[1] as HTMLButtonElement;
    expect(submit.disabled).toBeTrue();
    ['1', '2', '3', '4'].forEach(press);
    await flush();
    expect(submit.disabled).toBeFalse();
    submit.click();
    await flush();
    expect(submit.disabled).toBeTrue();
    pending.next({ verified: true });
  });

  it('focuses the PIN field when it opens', async () => {
    await open();
    expect(document.activeElement).toBe(input());
  });

  it('traps focus inside the dialog from both ends', async () => {
    await open();
    const container = q('.mat-mdc-dialog-container');
    const anchors = qa('.cdk-focus-trap-anchor');
    expect(anchors.length).toBeGreaterThanOrEqual(2);
    anchors[anchors.length - 1].focus();
    await flush();
    expect(container.contains(document.activeElement)).toBeTrue();
    anchors[0].focus();
    await flush();
    expect(container.contains(document.activeElement)).toBeTrue();
  });

  it('closes on Escape and restores focus to the opener', async () => {
    await open();
    const result = jasmine.createSpy('result');
    ref.afterClosed().subscribe(result);
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    await flush();
    expect(result).toHaveBeenCalledWith(undefined);
    expect(q('app-pin-dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('closes from the frame close button and Cancel, restoring focus', async () => {
    await open();
    q<HTMLButtonElement>('app-pin-dialog button[aria-label="Close"]').click();
    await flush();
    expect(q('app-pin-dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);

    opener.focus();
    await open();
    qa('[lzDialogActions] button')[0].click();
    await flush();
    expect(q('app-pin-dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('follows the configured PIN length', async () => {
    pinLength = 6;
    await open();
    ['1', '2', '3', '4', '5', '6', '7'].forEach(press);
    expect(input().value).toBe('123456');
    expect(input().getAttribute('maxlength')).toBe('6');
  });
});
