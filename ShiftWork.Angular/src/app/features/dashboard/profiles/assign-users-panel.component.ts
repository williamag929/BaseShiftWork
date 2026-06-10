import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { People } from 'src/app/core/models/people.model';
import { MatListModule } from "@angular/material/list";

@Component({
  selector: 'app-assign-users-panel',
  templateUrl: './assign-users-panel.component.html',
  styleUrls: ['./assign-users-panel.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatListModule
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

  ngOnChanges(changes: SimpleChanges) {
    if (changes['assignedUserIds']) {
      this.selectedUserIds = [...this.assignedUserIds];
    }
  }

  toggleUser(userId: number) {
    if (this.selectedUserIds.includes(userId)) {
      this.selectedUserIds = this.selectedUserIds.filter(id => id !== userId);
    } else {
      this.selectedUserIds.push(userId);
    }
  }

  save() {
    this.saveAssignments.emit(this.selectedUserIds);
  }

  close() {
    this.closePanel.emit();
  }
}
