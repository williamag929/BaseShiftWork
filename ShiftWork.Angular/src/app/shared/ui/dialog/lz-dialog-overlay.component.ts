import { A11yModule } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { LzDialogFrameComponent } from './lz-dialog-frame.component';

/**
 * Modal shell: scrim, dialog role, focus trap and a document-level Escape listener.
 * Wrap an lz-dialog-frame (which stays the projection host for [lzDialogActions]) or any content.
 */
@Component({
  selector: 'lz-dialog-overlay',
  standalone: true,
  imports: [A11yModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-[999] flex justify-center overflow-y-auto"
      [class.items-start]="placement === 'center'"
      [class.p-4]="placement === 'center'"
      [class.justify-end]="placement === 'end'"
    >
      <div class="fixed inset-0 bg-navy-900/40" data-testid="scrim" aria-hidden="true" (click)="closed.emit()"></div>
      <div
        [attr.role]="dialogRole"
        aria-modal="true"
        cdkTrapFocus
        cdkTrapFocusAutoCapture
        [attr.aria-labelledby]="frame ? frame.titleId : null"
        [attr.aria-label]="frame ? null : ariaLabel"
        class="relative bg-paper shadow-overlay"
        [class.my-auto]="placement === 'center'"
        [class.w-full]="true"
        [class.max-w-lg]="placement === 'center' && size === 'md'"
        [class.max-w-xl]="placement === 'center' && size === 'lg'"
        [class.max-w-3xl]="placement === 'center' && size === 'xl'"
        [class.rounded-dialog]="placement === 'center'"
        [class.border]="placement === 'center'"
        [class.border-line]="placement === 'center'"
        [class.h-full]="placement === 'end'"
        [class.max-w-md]="placement === 'end'"
        [class.overflow-y-auto]="placement === 'end'"
      >
        <ng-content />
      </div>
    </div>
  `,
})
export class LzDialogOverlayComponent implements OnInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly onDocKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') {
      return;
    }
    const target = event.target;
    if (target instanceof Node && this.host.nativeElement.querySelector('lz-dialog-frame')?.contains(target)) {
      return;
    }
    const foreign = Array.from(
      this.doc.querySelectorAll('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]'),
    ).some(d => !this.host.nativeElement.contains(d));
    if (!foreign) {
      this.closed.emit();
    }
  };

  @ContentChild(LzDialogFrameComponent) frame?: LzDialogFrameComponent;
  @Input() dialogRole: 'dialog' | 'alertdialog' = 'dialog';
  @Input() placement: 'center' | 'end' = 'center';
  @Input() size: 'md' | 'lg' | 'xl' = 'md';
  @Input() ariaLabel?: string;
  @Output() closed = new EventEmitter<void>();

  ngOnInit(): void {
    this.doc.addEventListener('keydown', this.onDocKeydown);
  }

  ngOnDestroy(): void {
    this.doc.removeEventListener('keydown', this.onDocKeydown);
  }
}
