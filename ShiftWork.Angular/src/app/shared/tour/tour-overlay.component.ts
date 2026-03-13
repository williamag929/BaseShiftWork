import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  Renderer2,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';
import { TourService, TourStep } from './tour.service';

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tour-overlay.component.html',
  styleUrls: ['./tour-overlay.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // None so that the .tour-highlighted rule (applied to external DOM nodes) works
  encapsulation: ViewEncapsulation.None,
})
export class TourOverlayComponent implements OnInit, OnDestroy {
  active = false;
  step: TourStep | null = null;
  stepIndex = 0;
  tooltipTop = 0;
  tooltipLeft = 0;

  private lastHighlightedEl: Element | null = null;
  private sub = new Subscription();

  // Tooltip width used for clamping (matches CSS)
  private readonly TOOLTIP_W = 340;
  private readonly TOOLTIP_H = 220;
  private readonly GAP = 16;

  constructor(
    public tour: TourService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      combineLatest([this.tour.active$, this.tour.stepIndex$]).subscribe(
        ([active, idx]) => {
          this.ngZone.run(() => {
            this.active = active;
            this.stepIndex = idx;
            this.step = this.tour.currentStep;
            this.updateHighlight();
            this.cdr.markForCheck();
          });
        },
      ),
    );
  }

  get totalSteps(): number {
    return this.tour.totalSteps;
  }

  next(): void {
    this.tour.next();
  }

  prev(): void {
    this.tour.prev();
  }

  endTour(): void {
    this.tour.endTour();
  }

  private updateHighlight(): void {
    // Remove previous highlight
    if (this.lastHighlightedEl) {
      this.renderer.removeClass(this.lastHighlightedEl, 'tour-highlighted');
      this.lastHighlightedEl = null;
    }

    if (!this.active || !this.step) return;

    const targetId = this.step.targetId;

    if (!targetId) {
      // Welcome / finish — centred card
      this.tooltipTop = Math.max(window.innerHeight / 2 - this.TOOLTIP_H / 2, 80);
      this.tooltipLeft = Math.max(window.innerWidth / 2 - this.TOOLTIP_W / 2, 10);
      return;
    }

    // Small delay lets the sidebar animation settle before measuring
    setTimeout(() => {
      const el = document.getElementById(targetId);
      if (!el) {
        this.tooltipTop = Math.max(window.innerHeight / 2 - this.TOOLTIP_H / 2, 80);
        this.tooltipLeft = Math.max(window.innerWidth / 2 - this.TOOLTIP_W / 2, 10);
        this.ngZone.run(() => this.cdr.markForCheck());
        return;
      }

      this.renderer.addClass(el, 'tour-highlighted');
      this.lastHighlightedEl = el;
      this.computeTooltipPosition(el);
      this.ngZone.run(() => this.cdr.markForCheck());
    }, 150);
  }

  private computeTooltipPosition(el: Element): void {
    const rect = el.getBoundingClientRect();
    const position = this.step?.position ?? 'right';
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'right':
        top = rect.top + rect.height / 2 - this.TOOLTIP_H / 2;
        left = rect.right + this.GAP;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - this.TOOLTIP_H / 2;
        left = rect.left - this.TOOLTIP_W - this.GAP;
        break;
      case 'bottom':
        top = rect.bottom + this.GAP;
        left = rect.left + rect.width / 2 - this.TOOLTIP_W / 2;
        break;
      case 'top':
        top = rect.top - this.TOOLTIP_H - this.GAP;
        left = rect.left + rect.width / 2 - this.TOOLTIP_W / 2;
        break;
    }

    // Clamp within viewport
    this.tooltipTop = Math.max(10, Math.min(top, vh - this.TOOLTIP_H - 10));
    this.tooltipLeft = Math.max(10, Math.min(left, vw - this.TOOLTIP_W - 10));
  }

  ngOnDestroy(): void {
    if (this.lastHighlightedEl) {
      this.renderer.removeClass(this.lastHighlightedEl, 'tour-highlighted');
    }
    this.sub.unsubscribe();
  }
}
