import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface RepeatPattern {
  patternType: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  repeatEvery: number; // e.g., every 2 weeks
  daysOfWeek?: number[]; // 0=Sunday, 6=Saturday
  endDate?: Date;
  occurrences?: number; // alternative to endDate
}

export interface RepeatPatternRequest {
  personId: number;
  locationId: number;
  areaId: number;
  startTime: string;
  endTime: string;
  baseDate: Date;
  pattern: RepeatPattern;
}

@Component({
  selector: 'app-repeat-pattern-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './repeat-pattern-modal.component.html',
  styleUrl: './repeat-pattern-modal.component.css'
})
export class RepeatPatternModalComponent {
  @Input() personId: number | null = null;
  @Input() personName: string = '';
  @Input() baseDate: Date = new Date();
  @Input() startTime: string = '09:00';
  @Input() endTime: string = '17:00';
  @Input() locationId: number = 0;
  @Input() areaId: number = 0;
  @Output() save = new EventEmitter<RepeatPatternRequest>();
  @Output() close = new EventEmitter<void>();

  patternType: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom' = 'weekly';
  repeatEvery: number = 1;
  selectedDaysOfWeek: boolean[] = [false, false, false, false, false, false, false]; // Sun-Sat
  endType: 'date' | 'occurrences' = 'occurrences';
  endDate: string = '';
  occurrences: number = 4;
  errorMessage: string = '';

  dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  ngOnInit(): void {
    // Default to 4 weeks from base date
    const fourWeeksOut = new Date(this.baseDate);
    fourWeeksOut.setDate(fourWeeksOut.getDate() + 28);
    this.endDate = this.formatDateForInput(fourWeeksOut);

    // Pre-select the day of week matching the base date
    if (this.patternType === 'weekly') {
      const dayOfWeek = this.baseDate.getDay();
      this.selectedDaysOfWeek[dayOfWeek] = true;
    }
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  toggleDay(index: number): void {
    this.selectedDaysOfWeek[index] = !this.selectedDaysOfWeek[index];
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

    // Validation based on pattern type
    if (this.patternType === 'weekly' || this.patternType === 'biweekly') {
      const hasSelectedDays = this.selectedDaysOfWeek.some(day => day);
      if (!hasSelectedDays) {
        this.errorMessage = 'Please select at least one day of the week.';
        return;
      }
    }

    if (this.endType === 'date' && !this.endDate) {
      this.errorMessage = 'Please specify an end date.';
      return;
    }

    if (this.endType === 'occurrences' && this.occurrences < 1) {
      this.errorMessage = 'Occurrences must be at least 1.';
      return;
    }

    const daysOfWeek = this.selectedDaysOfWeek
      .map((selected, index) => selected ? index : -1)
      .filter(index => index >= 0);

    const pattern: RepeatPattern = {
      patternType: this.patternType,
      repeatEvery: this.repeatEvery,
      daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : undefined,
      endDate: this.endType === 'date' ? new Date(this.endDate) : undefined,
      occurrences: this.endType === 'occurrences' ? this.occurrences : undefined
    };

    const request: RepeatPatternRequest = {
      personId: this.personId,
      locationId: this.locationId,
      areaId: this.areaId,
      startTime: this.startTime,
      endTime: this.endTime,
      baseDate: this.baseDate,
      pattern
    };

    this.save.emit(request);
  }
}
