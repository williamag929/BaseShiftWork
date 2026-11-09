import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of } from 'rxjs';

import { AuditHistoryButtonComponent } from './audit-history-button.component';
import { AuditHistoryDialogComponent } from './audit-history-dialog.component';
import { AuditHistoryFiltersComponent } from './audit-history-filters.component';
import { AuditHistoryTimelineComponent } from './audit-history-timeline.component';
import { AuditHistoryService } from 'src/app/core/services/audit-history.service';

describe('Audit history (design system)', () => {
  const item = (id: string, actionType: 'Created' | 'Updated' | 'Deleted') => ({
    id, entityName: 'Person', entityId: '1', actionType, actionDate: new Date(), userId: 'u1', userName: 'Ana',
  });

  describe('filters', () => {
    it('uses native 48px controls, hides the entity filter by default and has one primary', () => {
      const f = TestBed.createComponent(AuditHistoryFiltersComponent);
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('#audit-entity-type')).toBeNull();
      for (const control of Array.from(el.querySelectorAll<HTMLElement>('select, input'))) {
        expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
      }
      expect(el.querySelectorAll('button[variant="primary"]').length).toBe(1);
      expect(el.querySelector('mat-form-field, mat-select')).toBeNull();
    });

    it('shows the entity filter when requested and keeps dates as Date values', () => {
      const f = TestBed.createComponent(AuditHistoryFiltersComponent);
      f.componentInstance.showEntityTypeFilter = true;
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('#audit-entity-type')).not.toBeNull();
      const input = el.querySelector('#audit-start-date') as HTMLInputElement;
      input.value = '2026-01-15';
      input.dispatchEvent(new Event('change'));
      const value = f.componentInstance.filterForm.get('startDate')!.value as Date;
      expect(value instanceof Date).toBeTrue();
      expect(value.getFullYear()).toBe(2026);
      expect(value.getDate()).toBe(15);
    });
  });

  describe('timeline', () => {
    it('renders an lz-empty-state when empty and labels each action in text', () => {
      const f = TestBed.createComponent(AuditHistoryTimelineComponent);
      f.detectChanges();
      expect(f.nativeElement.querySelector('lz-empty-state.no-data')).not.toBeNull();
      f.componentInstance.items = [item('1', 'Created'), item('2', 'Deleted')] as any;
      f.detectChanges();
      const text = f.nativeElement.textContent as string;
      expect(text).toContain('Created');
      expect(text).toContain('Deleted');
      expect(f.nativeElement.querySelector('lz-empty-state')).toBeNull();
    });
  });

  describe('dialog', () => {
    async function open(total: number) {
      const service = jasmine.createSpyObj<AuditHistoryService>('AuditHistoryService', ['getAuditHistoryForEntity', 'getRelatedAuditHistory']);
      service.getAuditHistoryForEntity.and.returnValue(of({
        actions: total ? [item('1', 'Updated')] : [], totalCount: total, pageNumber: 1, pageSize: 20, totalPages: 1,
      } as any));
      service.getRelatedAuditHistory.and.returnValue(of([]));
      await TestBed.configureTestingModule({
        imports: [AuditHistoryDialogComponent],
        providers: [
          { provide: AuditHistoryService, useValue: service },
          { provide: MAT_DIALOG_DATA, useValue: { entityName: 'Person', entityId: '1', entityDisplayName: 'Ana Perez', companyId: 'c1' } },
        ],
      }).compileComponents();
      const f = TestBed.createComponent(AuditHistoryDialogComponent);
      f.detectChanges();
      return f;
    }

    it('renders inside lz-dialog-frame with a close button and one primary action at most', async () => {
      const f = await open(1);
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('lz-dialog-frame')).not.toBeNull();
      expect(el.querySelector('h2')!.textContent).toContain('Ana Perez');
      expect(el.querySelector('button[aria-label="Close"]')).not.toBeNull();
      expect(el.querySelectorAll('button[variant="primary"]').length).toBeLessThanOrEqual(1);
    });

    it('shows a single empty state when there are no changes, never the timeline empty state too', async () => {
      const f = await open(0);
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelectorAll('lz-empty-state').length).toBe(1);
      expect(el.querySelector('app-audit-history-timeline')).toBeNull();
    });

    it('switches between tabs with pressed state and shows the summary', async () => {
      const f = await open(1);
      const el = f.nativeElement as HTMLElement;
      const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>('lz-segmented button'));
      expect(tabs.length).toBe(3);
      expect(tabs[0].getAttribute('aria-pressed')).toBe('true');
      tabs[2].click();
      f.detectChanges();
      expect(tabs[2].getAttribute('aria-pressed')).toBe('true');
      expect(el.textContent).toContain('Change statistics');
    });
  });

  describe('button', () => {
    it('is a 48px quiet icon-only button labelled with the entity type', () => {
      const f = TestBed.createComponent(AuditHistoryButtonComponent);
      f.componentInstance.entityType = 'Location';
      f.detectChanges();
      const button = f.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.getAttribute('aria-label')).toBe('View history for Location');
      expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(48);
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    });
  });
});
