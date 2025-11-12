import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreateTimeOffRequest } from 'src/app/core/models/time-off-request.model';

@Component({
  selector: 'app-time-off-request-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './time-off-request-modal.component.html',
  styleUrls: ['./time-off-request-modal.component.css']
})
export class TimeOffRequestModalComponent implements OnInit {
  @Input() personId: number | null = null;
  @Input() personName: string = '';
  @Input() initialStartDate?: Date;
  @Input() initialEndDate?: Date;
  @Output() save = new EventEmitter<CreateTimeOffRequest>();
  @Output() close = new EventEmitter<void>();

  requestType: string = 'Vacation';
  startDate: string = '';
  endDate: string = '';
  isPartialDay: boolean = false;
  partialStartTime: string = '09:00';
  partialEndTime: string = '17:00';
  reason: string = '';
  
  requestTypes = [
    { value: 'Vacation', label: 'Vacation' },
    { value: 'Sick', label: 'Sick Leave' },
    { value: 'PTO', label: 'PTO' },
    { value: 'Personal', label: 'Personal Day' },
    { value: 'Unpaid', label: 'Unpaid Leave' }
  ];

  submitting: boolean = false;
  errorMessage: string = '';

  ngOnInit(): void {
    const today = new Date();
    if (this.initialStartDate) {
      this.startDate = this.formatDateForInput(this.initialStartDate);
    } else {
      this.startDate = this.formatDateForInput(today);
    }
    
    if (this.initialEndDate) {
      this.endDate = this.formatDateForInput(this.initialEndDate);
    } else {
      this.endDate = this.formatDateForInput(today);
    }
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onSubmit(): void {
    if (!this.personId) {
      this.errorMessage = 'Person is required';
      return;
    }

    if (!this.startDate || !this.endDate) {
      this.errorMessage = 'Start and end dates are required';
      return;
    }

    const start = new Date(this.startDate);
    const end = new Date(this.endDate);

    if (end < start) {
      this.errorMessage = 'End date must be after start date';
      return;
    }

    this.errorMessage = '';
    this.submitting = true;

    const request: CreateTimeOffRequest = {
      personId: this.personId,
      type: this.requestType,
      startDate: start,
      endDate: end,
      isPartialDay: this.isPartialDay,
      partialStartTime: this.isPartialDay ? this.partialStartTime : undefined,
      partialEndTime: this.isPartialDay ? this.partialEndTime : undefined,
      reason: this.reason || undefined
    };

    this.save.emit(request);
  }

  onClose(): void {
    this.close.emit();
  }

  resetSubmitting(): void {
    this.submitting = false;
  }
}
