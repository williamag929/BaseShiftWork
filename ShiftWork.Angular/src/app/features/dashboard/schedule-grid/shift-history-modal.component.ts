import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShiftEventService } from 'src/app/core/services/shift-event.service';
import { ScheduleService } from 'src/app/core/services/schedule.service';
import { ShiftEvent } from 'src/app/core/models/shift-event.model';
import { Schedule } from 'src/app/core/models/schedule.model';

interface ShiftHistoryEntry {
  date: Date;
  schedules: Schedule[];
  events: ShiftEvent[];
  clockIn?: Date;
  clockOut?: Date;
  duration?: string;
  status: 'completed' | 'missed' | 'partial' | 'sick' | 'timeoff';
}

@Component({
  selector: 'app-shift-history-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shift-history-modal.component.html',
  styleUrl: './shift-history-modal.component.css'
})
export class ShiftHistoryModalComponent implements OnInit {
  @Input() personId: number | null = null;
  @Input() personName: string = '';
  @Input() companyId: string = '';
  @Output() close = new EventEmitter<void>();

  loading: boolean = true;
  historyEntries: ShiftHistoryEntry[] = [];
  errorMessage: string = '';
  
  // Filter options
  dateRange: 'week' | 'month' | 'quarter' | 'year' | 'all' = 'month';
  statusFilter: 'all' | 'completed' | 'missed' | 'sick' = 'all';

  constructor(
    private shiftEventService: ShiftEventService,
    private scheduleService: ScheduleService
  ) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    if (!this.personId || !this.companyId) {
      this.errorMessage = 'Missing person or company information';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (this.dateRange) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case 'all':
        startDate.setFullYear(endDate.getFullYear() - 2); // Last 2 years
        break;
    }

    // Fetch both schedules and events
    Promise.all([
      this.scheduleService.getSchedules(this.companyId).toPromise(),
      this.shiftEventService.getShiftEventsByPersonId(this.companyId, this.personId).toPromise()
    ]).then(([schedules, events]) => {
      // Filter by person and date range
      const personSchedules = (schedules || []).filter(s => 
        s.personId === this.personId &&
        new Date(s.startDate) >= startDate &&
        new Date(s.startDate) <= endDate
      );

      const personEvents = (events || []).filter(e =>
        new Date(e.eventDate) >= startDate &&
        new Date(e.eventDate) <= endDate
      );

      // Group by date
      this.historyEntries = this.groupHistoryByDate(personSchedules, personEvents);
      this.loading = false;
    }).catch(err => {
      console.error('Failed to load shift history', err);
      this.errorMessage = 'Failed to load shift history. Please try again.';
      this.loading = false;
    });
  }

  groupHistoryByDate(schedules: Schedule[], events: ShiftEvent[]): ShiftHistoryEntry[] {
    const dateMap = new Map<string, ShiftHistoryEntry>();

    // Process schedules
    schedules.forEach(schedule => {
      const dateKey = new Date(schedule.startDate).toDateString();
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          date: new Date(schedule.startDate),
          schedules: [],
          events: [],
          status: 'completed'
        });
      }
      dateMap.get(dateKey)!.schedules.push(schedule);
    });

    // Process events
    events.forEach(event => {
      const dateKey = new Date(event.eventDate).toDateString();
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          date: new Date(event.eventDate),
          schedules: [],
          events: [],
          status: 'completed'
        });
      }
      const entry = dateMap.get(dateKey)!;
      entry.events.push(event);

      // Determine clock times
      if (event.eventType?.toLowerCase() === 'clockin') {
        entry.clockIn = new Date(event.eventDate);
      } else if (event.eventType?.toLowerCase() === 'clockout') {
        entry.clockOut = new Date(event.eventDate);
      } else if (event.eventType?.toLowerCase() === 'sick') {
        entry.status = 'sick';
      } else if (event.eventType?.toLowerCase() === 'timeoff') {
        entry.status = 'timeoff';
      }
    });

    // Calculate durations and determine status
    dateMap.forEach((entry, key) => {
      if (entry.clockIn && entry.clockOut) {
        const diff = entry.clockOut.getTime() - entry.clockIn.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        entry.duration = `${hours}h ${minutes}m`;
        entry.status = 'completed';
      } else if (entry.schedules.length > 0 && !entry.clockIn && entry.status === 'completed') {
        // Had a schedule but no clock-in
        const scheduleDate = new Date(entry.schedules[0].startDate);
        if (scheduleDate < new Date()) {
          entry.status = 'missed';
        }
      } else if (entry.clockIn && !entry.clockOut) {
        entry.status = 'partial';
      }
    });

    // Convert to array and sort by date (newest first)
    return Array.from(dateMap.values())
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  get filteredEntries(): ShiftHistoryEntry[] {
    if (this.statusFilter === 'all') {
      return this.historyEntries;
    }
    return this.historyEntries.filter(e => e.status === this.statusFilter);
  }

  onDateRangeChange(): void {
    this.loadHistory();
  }

  onClose(): void {
    this.close.emit();
  }

  formatTime(date: Date | undefined): string {
    if (!date) return '--:--';
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return '#4caf50';
      case 'missed': return '#f44336';
      case 'partial': return '#ff9800';
      case 'sick': return '#9c27b0';
      case 'timeoff': return '#2196f3';
      default: return '#757575';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed': return 'Completed';
      case 'missed': return 'Missed';
      case 'partial': return 'In Progress';
      case 'sick': return 'Sick';
      case 'timeoff': return 'Time Off';
      default: return 'Unknown';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return 'bi-check-circle-fill';
      case 'missed': return 'bi-x-circle-fill';
      case 'partial': return 'bi-clock-fill';
      case 'sick': return 'bi-thermometer-half';
      case 'timeoff': return 'bi-calendar-x';
      default: return 'bi-question-circle';
    }
  }

  getCompletedCount(): number {
    return this.filteredEntries.filter(e => e.status === 'completed').length;
  }

  getMissedCount(): number {
    return this.filteredEntries.filter(e => e.status === 'missed').length;
  }
}
