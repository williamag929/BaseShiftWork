import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { AdminPasswordDialogComponent } from './admin-password-dialog/admin-password-dialog.component';
import { LocationSelectDialogComponent } from './location-select-dialog/location-select-dialog.component';
import { QuestionDialogComponent } from './question-dialog/question-dialog.component';

describe('Kiosk dialogs (design system)', () => {
  let dialog: MatDialog;
  let opener: HTMLButtonElement;

  const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector(selector) as T;
  const qa = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector));
  const flush = async () => {
    await Promise.resolve();
    await new Promise(r => setTimeout(r, 0));
    TestBed.inject(ApplicationRef).tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, AdminPasswordDialogComponent, LocationSelectDialogComponent, QuestionDialogComponent],
      providers: [provideNoopAnimations()],
    });
    dialog = TestBed.inject(MatDialog);
    opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
  });

  afterEach(async () => {
    dialog.closeAll();
    await flush();
    opener.remove();
  });

  describe('admin password dialog', () => {
    async function open(): Promise<MatDialogRef<AdminPasswordDialogComponent>> {
      const ref = dialog.open(AdminPasswordDialogComponent, {
        width: '350px',
        maxWidth: '95vw',
        panelClass: 'lz-dialog-surface',
        disableClose: true,
        data: { companyId: 'co-1' },
      });
      await flush();
      return ref;
    }

    it('renders inside lz-dialog-frame without a close button because it cannot be dismissed', async () => {
      await open();
      expect(q('app-admin-password-dialog lz-dialog-frame')).not.toBeNull();
      expect(q('app-admin-password-dialog button[aria-label="Close"]')).toBeNull();
    });

    it('keeps actions at 56px with one primary button and focuses the field', async () => {
      await open();
      const buttons = qa('[lzDialogActions] button');
      expect(buttons.length).toBe(2);
      for (const button of buttons) {
        expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(56);
      }
      expect(qa('app-admin-password-dialog button[variant="primary"]').length).toBe(1);
      expect(document.activeElement).toBe(q('#kiosk-admin-password'));
    });

    it('shows an incorrect-password danger alert with role=alert', async () => {
      const http = TestBed.inject(HttpTestingController);
      await open();
      const field = q<HTMLInputElement>('#kiosk-admin-password');
      field.value = 'nope';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await flush();
      qa('[lzDialogActions] button')[1].click();
      http.expectOne(r => r.url.endsWith('/kiosk/co-1/verify-admin-password')).flush({ verified: false });
      await flush();
      const alert = q('app-admin-password-dialog lz-alert');
      expect(alert.getAttribute('role')).toBe('alert');
      expect(alert.textContent).toContain('Incorrect password');
    });

    it('stays open on Escape because disableClose is set', async () => {
      await open();
      q('#kiosk-admin-password').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
      await flush();
      expect(q('app-admin-password-dialog')).not.toBeNull();
    });
  });

  describe('location select dialog', () => {
    const locations = [
      { locationId: 1, name: 'Main office' },
      { locationId: 2, name: 'Warehouse' },
    ] as any[];

    async function open(disableClose: boolean) {
      const ref = dialog.open(LocationSelectDialogComponent, {
        width: '400px',
        maxWidth: '95vw',
        panelClass: 'lz-dialog-surface',
        disableClose,
        data: { locations },
      });
      await flush();
      return ref;
    }

    it('uses a native select and a 56px select action that stays disabled until a choice is made', async () => {
      await open(false);
      const select = q<HTMLSelectElement>('#kiosk-location');
      expect(select.tagName).toBe('SELECT');
      expect(select.getBoundingClientRect().height).toBeGreaterThanOrEqual(56);
      const submit = qa('[lzDialogActions] button')[1] as HTMLButtonElement;
      expect(submit.disabled).toBeTrue();
      select.selectedIndex = 1;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(submit.disabled).toBeFalse();
    });

    it('returns the chosen location and the device assignment', async () => {
      const ref = await open(false);
      const result = jasmine.createSpy('result');
      ref.afterClosed().subscribe(result);
      const select = q<HTMLSelectElement>('#kiosk-location');
      select.selectedIndex = 1;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const check = q<HTMLInputElement>('app-location-select-dialog input[type="checkbox"]');
      check.click();
      await flush();
      qa('[lzDialogActions] button')[1].click();
      await flush();
      expect(result).toHaveBeenCalledWith({ location: locations[1], assignToDevice: true });
    });

    it('offers a close button only when the dialog can be dismissed', async () => {
      await open(false);
      expect(q('app-location-select-dialog button[aria-label="Close"]')).not.toBeNull();
      dialog.closeAll();
      await flush();
      await open(true);
      expect(q('app-location-select-dialog button[aria-label="Close"]')).toBeNull();
    });

    it('makes the checkbox row a 56px target', async () => {
      await open(false);
      const row = q('app-location-select-dialog input[type="checkbox"]').closest('label') as HTMLElement;
      expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(56);
    });
  });

  describe('question dialog', () => {
    const questions = [
      { kioskQuestionId: 11, questionText: 'Any injuries?' },
      { kioskQuestionId: 12, questionText: 'Any damage?' },
    ] as any[];

    async function open() {
      const ref = dialog.open(QuestionDialogComponent, { width: '400px', maxWidth: '95vw', panelClass: 'lz-dialog-surface', data: { questions } });
      await flush();
      return ref;
    }

    it('renders a fieldset per question with 56px Yes/No targets', async () => {
      await open();
      expect(qa('app-question-dialog fieldset').length).toBe(2);
      const labels = qa('app-question-dialog fieldset label');
      expect(labels.length).toBe(4);
      for (const label of labels) {
        expect(label.getBoundingClientRect().height).toBeGreaterThanOrEqual(56);
      }
    });

    it('keeps Submit disabled until every question is answered and submits the answers', async () => {
      const ref = await open();
      const result = jasmine.createSpy('result');
      ref.afterClosed().subscribe(result);
      const submit = q<HTMLButtonElement>('[lzDialogActions] button');
      expect(submit.disabled).toBeTrue();
      const radios = qa('app-question-dialog input[type="radio"]') as HTMLInputElement[];
      radios[0].click();
      radios[3].click();
      await flush();
      expect(submit.disabled).toBeFalse();
      submit.click();
      await flush();
      expect(result).toHaveBeenCalledWith({ 11: 'Yes', 12: 'No' });
    });

    it('closes without answers from the close button', async () => {
      const ref = await open();
      const result = jasmine.createSpy('result');
      ref.afterClosed().subscribe(result);
      q<HTMLButtonElement>('app-question-dialog button[aria-label="Close"]').click();
      await flush();
      expect(result).toHaveBeenCalledWith(undefined);
    });
  });
});
