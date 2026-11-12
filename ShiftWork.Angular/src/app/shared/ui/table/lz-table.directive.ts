import { Directive } from '@angular/core';

@Directive({
  selector: 'table[lzTable]',
  standalone: true,
  host: {
    class:
      'w-full border-collapse text-left [&_thead]:bg-paper-alt [&_thead]:text-ink-soft [&_thead_tr]:border-b [&_thead_tr]:border-line [&_th]:px-4 [&_th]:py-3 [&_thead_th]:text-[12px] [&_thead_th]:font-semibold [&_thead_th]:uppercase [&_thead_th]:tracking-[0.06em] [&_tbody_tr]:border-b [&_tbody_tr]:border-line-soft [&_tbody_tr:last-child]:border-b-0 [&_td]:px-4 [&_td]:py-3',
  },
})
export class LzTableDirective {}
