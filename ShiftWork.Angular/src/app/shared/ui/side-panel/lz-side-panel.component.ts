import { A11yModule } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  afterNextRender,
  inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LzButtonDirective } from '../button/lz-button.directive';

let nextId = 0;

@Component({
  selector: 'lz-side-panel',
  standalone: true,
  imports: [A11yModule, MatIconModule, LzButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div class="fixed inset-0 z-30 bg-navy-900/40" data-testid="scrim" (click)="requestClose()"></div>
      <div
        #panel
        cdkTrapFocus
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="headingId"
        class="fixed inset-y-0 right-0 z-40 flex w-full flex-col bg-paper text-ink shadow-overlay transition-transform duration-200 starting:translate-x-full motion-reduce:transition-none lg:w-[30rem]"
      >
        <header class="flex items-start justify-between gap-2 border-b border-line-soft px-4 py-3">
          <div class="min-w-0">
            <h2 [id]="headingId" class="font-display text-lg font-semibold leading-tight">{{ heading }}</h2>
            @if (subtitle) {
              <p class="text-ink-soft">{{ subtitle }}</p>
            }
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <ng-content select="[lzPanelHeaderActions]" />
            <button
              lzButton
              variant="quiet"
              iconOnly
              type="button"
              aria-label="Close"
              i18n-aria-label="@@common.close_aria"
              (click)="requestClose()"
            >
              <mat-icon aria-hidden="true">close</mat-icon>
            </button>
          </div>
        </header>

        @if (confirming) {
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft bg-paper-alt px-4 py-3" role="alert">
            <span class="font-medium" i18n="@@ui.side_panel.discard_prompt">Discard your changes?</span>
            <div class="flex gap-2">
              <button lzButton variant="secondary" type="button" (click)="keepEditing()" i18n="@@ui.side_panel.keep_editing">Keep editing</button>
              <button lzButton variant="secondary" type="button" (click)="discard()"><span class="text-danger-ink" i18n="@@ui.side_panel.discard">Discard</span></button>
            </div>
          </div>
        }

        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4"><ng-content /></div>

        <footer class="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft px-4 pt-3 pb-[env(safe-area-inset-bottom)] empty:hidden">
          <ng-content select="[lzPanelFooter]" />
        </footer>
      </div>
    }
  `,
})
export class LzSidePanelComponent implements OnChanges, OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly cdr = inject(ChangeDetectorRef);
  private opener: HTMLElement | null = null;
  private anchor: Comment | null = null;
  private scroller: HTMLElement | null = null;
  private scrollerOverflow = '';
  private readonly onDocKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }
    const own = this.host.nativeElement.querySelector(':scope > [role="dialog"]');
    const foreign = Array.from(this.doc.querySelectorAll('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]')).some(
      d => d !== own,
    );
    if (foreign) {
      return;
    }
    this.requestClose();
  };

  readonly headingId = `lz-side-panel-title-${nextId++}`;
  confirming = false;

  @Input({ required: true }) heading!: string;
  @Input() subtitle?: string;
  @Input() open = false;
  @Input() dirty = false;
  @Input() restoreFocusTo?: HTMLElement | null;
  @Output() closed = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['open'];
    if (!change || change.previousValue === change.currentValue) {
      return;
    }
    if (this.open) {
      this.onOpen();
    } else {
      this.onClose();
    }
  }

  ngOnDestroy(): void {
    this.release();
  }

  keepEditing(): void {
    this.confirming = false;
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-label="Close"]')?.focus(), {
      injector: this.injector,
    });
  }

  requestClose(): void {
    if (this.dirty) {
      this.confirming = true;
      this.cdr.markForCheck();
    } else {
      this.closed.emit();
    }
  }

  discard(): void {
    this.confirming = false;
    this.closed.emit();
  }

  private onOpen(): void {
    const active = this.doc.activeElement;
    this.opener = active instanceof HTMLElement && active !== this.doc.body ? active : null;
    this.confirming = false;
    const el = this.host.nativeElement;
    this.scroller = el.parentElement?.closest<HTMLElement>('mat-sidenav-content') ?? this.doc.body;
    this.scrollerOverflow = this.scroller.style.overflow;
    this.scroller.style.overflow = 'hidden';
    this.anchor = this.doc.createComment('lz-side-panel');
    el.parentNode?.insertBefore(this.anchor, el);
    this.doc.body.appendChild(el);
    this.doc.addEventListener('keydown', this.onDocKeydown);
    afterNextRender(
      () => {
        const panel = this.host.nativeElement.querySelector<HTMLElement>('[role="dialog"]');
        const field = panel?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
        (field ?? panel?.querySelector<HTMLElement>('button'))?.focus();
      },
      { injector: this.injector },
    );
  }

  private onClose(): void {
    this.confirming = false;
    this.release();
    const preferred = this.restoreFocusTo?.isConnected ? this.restoreFocusTo : null;
    const opener = preferred ?? (this.opener?.isConnected ? this.opener : null);
    this.opener = null;
    afterNextRender(() => opener?.focus(), { injector: this.injector });
  }

  private release(): void {
    this.doc.removeEventListener('keydown', this.onDocKeydown);
    if (this.scroller) {
      this.scroller.style.overflow = this.scrollerOverflow;
      this.scroller = null;
    }
    if (this.anchor) {
      this.anchor.replaceWith(this.host.nativeElement);
      this.anchor = null;
    }
  }
}
