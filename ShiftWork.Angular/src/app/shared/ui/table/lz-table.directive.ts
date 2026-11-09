import { Directive } from '@angular/core';

@Directive({
  selector: 'table[lzTable]',
  standalone: true,
  host: {
    class:
      'w-full border-collapse text-left [&_thead]:bg-paper-alt [&_thead]:text-[13px] [&_thead]:text-ink-soft [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_tbody_tr]:border-b [&_tbody_tr]:border-line-soft [&_td]:px-4 [&_td]:py-2',
  },
})
export class LzTableDirective {}
