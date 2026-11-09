import { Directive } from '@angular/core';

@Directive({
  selector: 'input[lzField], select[lzField], textarea[lzField]',
  standalone: true,
  host: {
    class:
      'min-h-12 w-full rounded-control border border-line-strong bg-paper px-3 font-[inherit] text-ink placeholder:text-ink-muted aria-[invalid=true]:border-danger',
  },
})
export class LzFieldDirective {}
