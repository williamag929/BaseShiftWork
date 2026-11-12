import { Directive, ElementRef, Input, booleanAttribute, inject } from '@angular/core';

export type LzButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'inverse';

@Directive({
  selector: 'button[lzButton], a[lzButton]',
  standalone: true,
  host: {
    '[class.min-h-12]': 'true',
    '[class.gap-2]': 'true',
    '[class.rounded-control]': 'true',
    '[class.font-medium]': 'true',
    '[class.inline-flex]': 'true',
    '[class.no-underline]': 'true',
    '[class.items-center]': 'true',
    '[class.justify-center]': 'true',
    '[class.px-4]': '!iconOnly',
    '[class.px-0]': 'iconOnly',
    '[class.w-12]': 'iconOnly',
    '[class.bg-ink]': '!isDisabled && variant === "primary"',
    '[class.text-paper]': '!isDisabled && (variant === "primary" || variant === "danger" || variant === "inverse")',
    '[class.border-hero-line]': '!isDisabled && variant === "inverse"',
    '[class.bg-hero-raised]': '!isDisabled && variant === "inverse"',
    '[class.bg-paper]': '!isDisabled && variant === "secondary"',
    '[class.text-ink]': '!isDisabled && variant === "secondary"',
    '[class.border]': 'true',
    '[class.border-ink]': '!isDisabled && variant === "primary"',
    '[class.border-danger]': '!isDisabled && variant === "danger"',
    '[class.border-transparent]': '!isDisabled && variant === "quiet"',
    '[class.bg-transparent]': '!isDisabled && variant === "quiet"',
    '[class.border-line-strong]': '!isDisabled && variant === "secondary"',
    '[class.bg-danger]': '!isDisabled && variant === "danger"',
    '[class.text-link]': '!isDisabled && variant === "quiet"',
    '[class.bg-neutral-bg]': 'isDisabled',
    '[class.text-ink-soft]': 'isDisabled',
    '[class.border-neutral-bg]': 'isDisabled',
    '[class.cursor-not-allowed]': 'isDisabled',
  },
})
export class LzButtonDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  @Input() variant: LzButtonVariant = 'secondary';
  @Input({ transform: booleanAttribute }) iconOnly = false;

  get isDisabled(): boolean {
    return (
      (this.el as HTMLButtonElement).disabled === true ||
      this.el.getAttribute('aria-disabled') === 'true'
    );
  }
}
