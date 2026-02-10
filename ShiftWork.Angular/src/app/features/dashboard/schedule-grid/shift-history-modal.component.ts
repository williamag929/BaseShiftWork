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
  actionError: string = '';
  
  // Filter options
  dateRange: 'week' | 'month' | 'quarter' | 'year' | 'all' = 'month';
  statusFilter: 'all' | 'completed' | 'missed' | 'sick' = 'all';

  editingScheduleId: number | null = null;
  editStartTime: string = '';
  editEndTime: string = '';
  editingClockEntryKey: string | null = null;
  editClockInTime: string = '';
  editClockOutTime: string = '';

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
    this.actionError = '';

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

    // Process schedules (use UTC date for grouping since schedule times are wall-clock UTC)
    schedules.forEach(schedule => {
      const d = new Date(schedule.startDate);
      const dateKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
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

  canManualClockOut(entry: ShiftHistoryEntry): boolean {
    return !!entry.clockIn && !entry.clockOut;
  }

  canApproveMissed(entry: ShiftHistoryEntry): boolean {
    return entry.status === 'missed' && entry.schedules.length > 0;
  }

  startEditClockTimes(entry: ShiftHistoryEntry): void {
    this.editingClockEntryKey = this.getEntryKey(entry);
    this.editClockInTime = entry.clockIn ? this.toTimeInput(entry.clockIn) : '';
    this.editClockOutTime = entry.clockOut ? this.toTimeInput(entry.clockOut) : '';
    this.actionError = '';
  }

  cancelEditClockTimes(): void {
    this.editingClockEntryKey = null;
    this.editClockInTime = '';
    this.editClockOutTime = '';
  }

  saveClockTimes(entry: ShiftHistoryEntry): void {
    if (!this.companyId || !this.personId) return;

    const clockInEvent = this.getLatestEvent(entry, 'clockin');
    const clockOutEvent = this.getLatestEvent(entry, 'clockout');

    if (this.editClockInTime && clockInEvent) {
      const updatedClockIn = this.roundToFiveMinutes(this.buildDateWithTime(entry.date, this.editClockInTime));
      const payload: ShiftEvent = {
        ...clockInEvent,
        eventDate: updatedClockIn
      } as ShiftEvent;
      this.shiftEventService.updateShiftEvent(this.companyId, clockInEvent.eventLogId, payload).subscribe({
        next: (updated) => {
          entry.clockIn = new Date(updated.eventDate);
        },
        error: (err) => {
          console.error('Failed to update clock-in', err);
          this.actionError = 'Failed to update clock-in time.';
        }
      });
    }

    if (this.editClockOutTime) {
      const updatedClockOut = this.roundToFiveMinutes(this.buildDateWithTime(entry.date, this.editClockOutTime));
      if (clockOutEvent) {
        const payload: ShiftEvent = {
          ...clockOutEvent,
          eventDate: updatedClockOut
        } as ShiftEvent;
        this.shiftEventService.updateShiftEvent(this.companyId, clockOutEvent.eventLogId, payload).subscribe({
          next: (updated) => {
            entry.clockOut = new Date(updated.eventDate);
            this.updateEntryDuration(entry);
            entry.status = 'completed';
          },
          error: (err) => {
            console.error('Failed to update clock-out', err);
            this.actionError = 'Failed to update clock-out time.';
          }
        });
      } else {
        const payload: ShiftEvent = {
          eventLogId: '00000000-0000-0000-0000-000000000000',
          eventDate: updatedClockOut,
          eventType: 'clockout',
          companyId: this.companyId,
          personId: this.personId,
          eventObject: JSON.stringify({ manualClockOut: true }),
          description: 'Manual clock-out',
          kioskDevice: null,
          geoLocation: null,
          photoUrl: null
        } as ShiftEvent;
        this.shiftEventService.createShiftEvent(this.companyId, payload).subscribe({
          next: (created) => {
            entry.clockOut = new Date(created.eventDate);
            entry.events.push(created);
            this.updateEntryDuration(entry);
            entry.status = 'completed';
          },
          error: (err) => {
            console.error('Failed to create clock-out', err);
            if (err?.status === 409) {
              this.actionError = 'Clock-out already exists. Refreshing history so you can edit the clock-out time.';
              this.loadHistory();
            } else {
              this.actionError = 'Failed to create manual clock-out.';
            }
          }
        });
      }
    }

    this.cancelEditClockTimes();
  }

  approveMissedShift(entry: ShiftHistoryEntry): void {
    if (!this.companyId || !this.personId) return;
    const schedule = entry.schedules[0];
    if (!schedule) return;

    const clockInDate = this.roundToFiveMinutes(new Date(schedule.startDate));
    const clockOutDate = this.roundToFiveMinutes(new Date(schedule.endDate));

    const clockInPayload: ShiftEvent = {
      eventLogId: '00000000-0000-0000-0000-000000000000',
      eventDate: clockInDate,
      eventType: 'clockin',
      companyId: this.companyId,
      personId: this.personId,
      eventObject: JSON.stringify({ manualClockIn: true, approvedMissed: true }),
      description: 'Manual clock-in (approved missed shift)',
      kioskDevice: null,
      geoLocation: null,
      photoUrl: null
    } as ShiftEvent;

    const clockOutPayload: ShiftEvent = {
      eventLogId: '00000000-0000-0000-0000-000000000000',
      eventDate: clockOutDate,
      eventType: 'clockout',
      companyId: this.companyId,
      personId: this.personId,
      eventObject: JSON.stringify({ manualClockOut: true, approvedMissed: true }),
      description: 'Manual clock-out (approved missed shift)',
      kioskDevice: null,
      geoLocation: null,
      photoUrl: null
    } as ShiftEvent;

    this.shiftEventService.createShiftEvent(this.companyId, clockInPayload).subscribe({
      next: (createdIn) => {
        entry.clockIn = new Date(createdIn.eventDate);
        entry.events.push(createdIn);

        this.shiftEventService.createShiftEvent(this.companyId, clockOutPayload).subscribe({
          next: (createdOut) => {
            entry.clockOut = new Date(createdOut.eventDate);
            entry.events.push(createdOut);
            this.updateEntryDuration(entry);
            entry.status = 'completed';
          },
          error: (err) => {
            console.error('Failed to create manual clock-out for missed shift', err);
            this.actionError = 'Failed to create manual clock-out for missed shift.';
          }
        });
      },
      error: (err) => {
        console.error('Failed to create manual clock-in for missed shift', err);
        this.actionError = 'Failed to create manual clock-in for missed shift.';
      }
    });
  }

  startEditSchedule(schedule: Schedule): void {
    this.editingScheduleId = schedule.scheduleId;
    const sd = new Date(schedule.startDate);
    const ed = new Date(schedule.endDate);
    this.editStartTime = sd.getUTCHours().toString().padStart(2, '0') + ':' + sd.getUTCMinutes().toString().padStart(2, '0');
    this.editEndTime = ed.getUTCHours().toString().padStart(2, '0') + ':' + ed.getUTCMinutes().toString().padStart(2, '0');
    this.actionError = '';
  }

  cancelEditSchedule(): void {
    this.editingScheduleId = null;
    this.editStartTime = '';
    this.editEndTime = '';
  }

  saveScheduleTime(schedule: Schedule): void {
    if (!this.companyId) return;
    const origStart = new Date(schedule.startDate);
    const origEnd = new Date(schedule.endDate);
    const [sh, sm] = this.editStartTime.split(':').map(Number);
    const [eh, em] = this.editEndTime.split(':').map(Number);
    const startDate = new Date(Date.UTC(origStart.getUTCFullYear(), origStart.getUTCMonth(), origStart.getUTCDate(), sh, sm, 0));
    const endDate = new Date(Date.UTC(origEnd.getUTCFullYear(), origEnd.getUTCMonth(), origEnd.getUTCDate(), eh, em, 0));

    const updated: Schedule = {
      ...schedule,
      startDate,
      endDate
    } as Schedule;

    this.scheduleService.updateSchedule(this.companyId, schedule.scheduleId, updated).subscribe({
      next: () => {
        schedule.startDate = startDate;
        schedule.endDate = endDate;
        this.cancelEditSchedule();
      },
      error: (err) => {
        console.error('Failed to update schedule time', err);
        this.actionError = 'Failed to update schedule time.';
      }
    });
  }

  approveSchedule(schedule: Schedule): void {
    if (!this.companyId) return;
    const updated: Schedule = {
      ...schedule,
      status: 'published'
    } as Schedule;

    this.scheduleService.updateSchedule(this.companyId, schedule.scheduleId, updated).subscribe({
      next: () => {
        schedule.status = 'published';
      },
      error: (err) => {
        console.error('Failed to approve schedule', err);
        this.actionError = 'Failed to approve schedule.';
      }
    });
  }

  manualClockOut(entry: ShiftHistoryEntry): void {
    this.startEditClockTimes(entry);
    if (!this.editClockOutTime) {
      this.editClockOutTime = this.toTimeInput(new Date());
    }
  }

  isUnpublished(schedule: Schedule): boolean {
    return (schedule.status || '').toLowerCase() !== 'published';
  }

  private toTimeInput(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private buildDateWithTime(date: Date, time: string): Date {
    const [h, m] = time.split(':').map(Number);
    const copy = new Date(date);
    copy.setHours(h, m, 0, 0);
    return copy;
  }

  private roundToFiveMinutes(date: Date): Date {
    const rounded = new Date(date);
    const minutes = rounded.getMinutes();
    const roundedMinutes = Math.round(minutes / 5) * 5;
    if (roundedMinutes === 60) {
      rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
    } else {
      rounded.setMinutes(roundedMinutes, 0, 0);
    }
    return rounded;
  }

  private getEntryKey(entry: ShiftHistoryEntry): string {
    return entry.date.toDateString();
  }

  private getLatestEvent(entry: ShiftHistoryEntry, type: string): ShiftEvent | undefined {
    return entry.events
      .filter(e => (e.eventType || '').toLowerCase() === type)
      .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())[0];
  }

  private updateEntryDuration(entry: ShiftHistoryEntry): void {
    if (entry.clockIn && entry.clockOut) {
      const diff = entry.clockOut.getTime() - entry.clockIn.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      entry.duration = `${hours}h ${minutes}m`;
    }
  }
}
