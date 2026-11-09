import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'lz-table-scroll',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block overflow-x-auto rounded-panel border border-line bg-paper' },
  template: `<ng-content />`,
})
export class LzTableScrollComponent {}
