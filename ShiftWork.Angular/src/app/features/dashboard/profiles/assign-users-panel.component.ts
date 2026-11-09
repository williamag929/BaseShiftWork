import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { People } from 'src/app/core/models/people.model';
import {
  LzButtonDirective, LzDialogFrameComponent, LzDialogOverlayComponent, LzFieldComponent, LzFieldDirective, LzPagerComponent, paginate,
} from 'src/app/shared/ui';

@Component({
  selector: 'app-assign-users-panel',
  templateUrl: './assign-users-panel.component.html',
  standalone: true,
  imports: [
    CommonModule, FormsModule, LzButtonDirective, LzDialogFrameComponent, LzDialogOverlayComponent, LzFieldComponent, LzFieldDirective,
    LzPagerComponent,
  ]
})
export class AssignUsersPanelComponent implements OnChanges {
  @Input() open = false;
  @Input() people: People[] = [];
  @Input() assignedUserIds: number[] = [];
  @Input() roleName = '';
  @Output() closePanel = new EventEmitter<void>();
  @Output() saveAssignments = new EventEmitter<number[]>();

  selectedUserIds: number[] = [];
  filter = '';
  page = 1;
  pageSize = 25;
  readonly paginate = paginate;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['assignedUserIds']) {
      this.selectedUserIds = [...this.assignedUserIds];
    }
    if (changes['open'] && this.open) {
      this.filter = '';
      this.page = 1;
    }
  }

  get title(): string {
    return $localize`:@@assign_users.title:Assign users to ${this.roleName}:name:`;
  }

  get filtered(): People[] {
    const q = this.filter.trim().toLowerCase();
    if (!q) return this.people;
    return this.people.filter(p => (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q));
  }

  toggleUser(userId: number) {
    if (this.selectedUserIds.includes(userId)) {
      this.selectedUserIds = this.selectedUserIds.filter(id => id !== userId);
    } else {
      this.selectedUserIds = [...this.selectedUserIds, userId];
    }
  }

  save() {
    this.saveAssignments.emit(this.selectedUserIds);
  }

  close() {
    this.closePanel.emit();
  }
}
