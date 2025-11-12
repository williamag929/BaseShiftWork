import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReplacementCandidate } from 'src/app/core/models/replacement-candidate.model';

@Component({
  selector: 'app-replacement-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './replacement-panel.component.html',
  styleUrls: ['./replacement-panel.component.css']
})
export class ReplacementPanelComponent {
  @Input() candidates: ReplacementCandidate[] = [];
  @Input() loading: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() notify = new EventEmitter<number>();
  @Output() assign = new EventEmitter<number>();

  onClose(): void {
    this.close.emit();
  }

  onNotify(personId: number): void {
    this.notify.emit(personId);
  }

  onAssign(personId: number): void {
    this.assign.emit(personId);
  }
}
