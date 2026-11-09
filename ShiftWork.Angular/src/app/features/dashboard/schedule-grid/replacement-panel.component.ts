import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { MatIconModule } from '@angular/material/icon';
import { LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzPanelComponent, LzStatusChipComponent } from 'src/app/shared/ui';
import { FormsModule } from '@angular/forms';
import { ReplacementCandidate } from 'src/app/core/models/replacement-candidate.model';

@Component({
  selector: 'app-replacement-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, MatIconModule, LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzPanelComponent, LzStatusChipComponent],
  templateUrl: './replacement-panel.component.html'
})
export class ReplacementPanelComponent {
  @Input() candidates: ReplacementCandidate[] = [];
  @Input() loading: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() notify = new EventEmitter<{ personId: number; channel: 'push' | 'sms' | 'email' }>();
  @Output() assign = new EventEmitter<number>();

  selectedChannel: 'push' | 'sms' | 'email' = 'push';

  onClose(): void {
    this.close.emit();
  }

  onNotify(personId: number): void {
    this.notify.emit({ personId, channel: this.selectedChannel });
  }

  onAssign(personId: number): void {
    this.assign.emit(personId);
  }
}
