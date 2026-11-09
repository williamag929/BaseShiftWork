import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

/** Re-parents its host to document.body so fixed overlays escape the sidenav's stacking context. */
@Directive({ selector: '[lzPortal]', standalone: true })
export class LzPortalDirective implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly doc = inject(DOCUMENT);

  ngOnInit(): void {
    this.doc.body.appendChild(this.el);
  }

  ngOnDestroy(): void {
    this.el.remove();
  }
}
