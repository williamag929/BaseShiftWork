import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SickReportRequest {
  personId: number;
  date: Date;
  endDate?: Date;
  isMultiDay: boolean;
  symptoms?: string;
  requiresDoctor: boolean;
  note?: string;
}

@Component({
  selector: 'app-sick-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sick-report-modal.component.html',
  styleUrl: './sick-report-modal.component.css'
})
export class SickReportModalComponent implements OnInit {
  @Input() personId: number | null = null;
  @Input() personName: string = '';
  @Input() initialDate?: Date;
  @Output() save = new EventEmitter<SickReportRequest>();
  @Output() close = new EventEmitter<void>();

  startDate: string = '';
  endDate: string = '';
  isMultiDay: boolean = false;
  symptoms: string = '';
  requiresDoctor: boolean = false;
  note: string = '';
  submitting: boolean = false;
  errorMessage: string = '';

  ngOnInit(): void {
    if (this.initialDate) {
      this.startDate = this.formatDateForInput(this.initialDate);
      this.endDate = this.formatDateForInput(this.initialDate);
    } else {
      const today = new Date();
      this.startDate = this.formatDateForInput(today);
      this.endDate = this.formatDateForInput(today);
    }
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onClose(): void {
    this.close.emit();
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.personId) {
      this.errorMessage = 'Person ID is required.';
      return;
    }

    if (!this.startDate) {
      this.errorMessage = 'Start date is required.';
      return;
    }

    const start = new Date(this.startDate);
    let end: Date | undefined = undefined;

    if (this.isMultiDay) {
      if (!this.endDate) {
        this.errorMessage = 'End date is required for multi-day sick leave.';
        return;
      }
      end = new Date(this.endDate);

      if (end < start) {
        this.errorMessage = 'End date must be after start date.';
        return;
      }
    }

    this.submitting = true;

    const request: SickReportRequest = {
      personId: this.personId,
      date: start,
      endDate: end,
      isMultiDay: this.isMultiDay,
      symptoms: this.symptoms || undefined,
      requiresDoctor: this.requiresDoctor,
      note: this.note || undefined
    };

    this.save.emit(request);
  }
}
