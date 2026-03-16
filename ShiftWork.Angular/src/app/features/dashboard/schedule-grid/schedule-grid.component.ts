
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { Observable, lastValueFrom } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { ScheduleService } from 'src/app/core/services/schedule.service';
import { ScheduleShiftService } from 'src/app/core/services/schedule-shift.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { LocationService } from 'src/app/core/services/location.service';
import { ShiftEventService } from 'src/app/core/services/shift-event.service';
import { TimeOffRequestService } from 'src/app/core/services/time-off-request.service';
import { ReplacementRequestService } from 'src/app/core/services/replacement-request.service';
import { SettingsHelperService } from 'src/app/core/services/settings-helper.service';
import { ShiftEvent } from 'src/app/core/models/shift-event.model';
import { ReplacementCandidate } from 'src/app/core/models/replacement-candidate.model';
import { CreateTimeOffRequest } from 'src/app/core/models/time-off-request.model';
import { 
  ScheduleGridData, 
  TeamMember, 
  ShiftBlock, 
  DaySchedule, 
  ScheduleFilters,
  LocationGroup,
  ViewMode,
  HorizonRange
} from 'src/app/core/models/schedule-grid.model';
import { ScheduleShift } from 'src/app/core/models/schedule-shift.model';
import { People } from 'src/app/core/models/people.model';
import { Schedule } from 'src/app/core/models/schedule.model';
import { Area } from 'src/app/core/models/area.model';
import { AreaService } from 'src/app/core/services/area.service';
import { Crew, CrewMemberAvailability } from 'src/app/core/models/crew.model';
import { CrewService } from 'src/app/core/services/crew.service';
import { ScheduleGridAddModalComponent } from './schedule-grid-add-modal.component';
import { ReplacementPanelComponent } from './replacement-panel.component';
import { TimeOffRequestModalComponent } from './time-off-request-modal.component';
import { SickReportModalComponent, SickReportRequest } from './sick-report-modal.component';
import { RepeatPatternModalComponent, RepeatPatternRequest } from './repeat-pattern-modal.component';
import { ShiftHistoryModalComponent } from './shift-history-modal.component';
import {
  ScheduleConflictModalComponent,
  ScheduleConflictInfo,
  ConflictViolation,
  BulkSkippedEntry
} from './schedule-conflict-modal.component';

@Component({
  selector: 'app-schedule-grid',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, ScheduleGridAddModalComponent, ReplacementPanelComponent, TimeOffRequestModalComponent, SickReportModalComponent, RepeatPatternModalComponent, ShiftHistoryModalComponent, ScheduleConflictModalComponent],
  templateUrl: './schedule-grid.component.html',
  styleUrl: './schedule-grid.component.css',
  providers: [ScheduleService, PeopleService, LocationService, AreaService, CrewService]
})
export class ScheduleGridComponent implements OnInit {
  // ...existing properties...

  /**
   * Handle bulk person checkbox change event from template
   */
  public onBulkPersonCheckboxChange(event: Event, personId: number): void {
    const checked = (event.target instanceof HTMLInputElement) ? event.target.checked : false;
    this.toggleBulkPersonSelection(personId, checked);
  }
  showAddScheduleModalFlag: boolean = false;
  showAddSchedulePlaceholder: boolean = false;
  selectedPersonId: number | null = null;
  selectedDate: Date | null = null;
  editingSchedule: Schedule | null = null;
  selectedShifts: Set<string> = new Set();
  showBulkActions: boolean = false;
  copiedShifts: ShiftBlock[] = [];
  deleteInProgress: boolean = false;

  // Handle delete emitted from modal
  onDeleteSchedule(scheduleId: number): void {
    if (!this.activeCompany?.companyId) return;
    if (!confirm('Delete this shift? This action cannot be undone.')) return;
    this.deleteInProgress = true;
    this.scheduleService.deleteSchedule(this.activeCompany.companyId, scheduleId).subscribe({
      next: () => {
        this.deleteInProgress = false;
        this.closeAddScheduleModal();
        this.loadScheduleData();
      },
      error: (err) => {
        this.deleteInProgress = false;
        console.error('Failed to delete schedule', err);
        alert('Failed to delete schedule');
      }
    });
  }

  // Handle view profile emitted from modal
  onViewProfile(personId: number): void {
    // Navigate to people route with query param (assumption)
    this.closeAddScheduleModal();
    this.router.navigate(['/dashboard/people'], { queryParams: { personId } });
  }

  handleRepeatTomorrow(payload: { baseDate: Date; personId: number|null; locationId: number; areaId: number; start: string; end: string }): void {
    if (!this.activeCompany?.companyId || !payload.personId) return;
    const tomorrow = new Date(payload.baseDate);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const startDate = this.buildDateWithTime(tomorrow, payload.start);
    const endDate = this.buildDateWithTime(tomorrow, payload.end);
    const conflict = this.findScheduleConflict(payload.personId, startDate, endDate);
    if (conflict) {
      this.showConflictModal(this.buildConflictInfo(payload.personId, startDate, endDate, conflict));
      return;
    }
    const schedule: Schedule = {
      scheduleId: 0,
      name: `Schedule for ${tomorrow.toDateString()}`,
      companyId: this.activeCompany.companyId,
      personId: payload.personId,
      startDate,
      endDate,
      locationId: payload.locationId,
      areaId: payload.areaId,
      status: 'unpublished',
      timezone: 'UTC'
    } as Schedule;
    this.scheduleService.createSchedule(this.activeCompany.companyId, schedule).subscribe({
      next: () => this.loadScheduleData(),
      error: err => console.error('Failed to repeat tomorrow', err)
    });
  }

  handleRepeatRestOfWeek(payload: { baseDate: Date; personId: number|null; locationId: number; areaId: number; start: string; end: string }): void {
    if (!this.activeCompany?.companyId || !payload.personId) return;
    const base = new Date(payload.baseDate);
    const weekStart = this.getWeekStart(base);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
    const promises: Promise<any>[] = [];
    const current = new Date(base);
    current.setUTCDate(current.getUTCDate() + 1);
    while (current < weekEnd) {
      const d = new Date(current);
      const startDate = this.buildDateWithTime(d, payload.start);
      const endDate = this.buildDateWithTime(d, payload.end);
      const conflict = this.findScheduleConflict(payload.personId, startDate, endDate);
      if (conflict) {
        this.showConflictModal(this.buildConflictInfo(payload.personId, startDate, endDate, conflict));
        return;
      }
      const schedule: Schedule = {
        scheduleId: 0,
        name: `Schedule for ${d.toDateString()}`,
        companyId: this.activeCompany.companyId,
        personId: payload.personId,
        startDate,
        endDate,
        locationId: payload.locationId,
        areaId: payload.areaId,
        status: 'unpublished',
        timezone: 'UTC'
      } as Schedule;
      promises.push(this.scheduleService.createSchedule(this.activeCompany.companyId, schedule).toPromise());
      current.setUTCDate(current.getUTCDate() + 1);
    }
    Promise.all(promises).then(() => this.loadScheduleData()).catch(err => console.error('Repeat rest of week failed', err));
  }

  private buildDateWithTime(date: Date, time: string): Date {
    const [h,m] = time.split(':').map(Number);
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      h, m, 0
    ));
  }

  handleRequestTimeOff(payload: { personId: number|null; start: Date; end: Date; note?: string }): void {
    if (!this.activeCompany?.companyId || !payload.personId) return;
    
    // Find the person name from peopleList
    const person = this.peopleList.find(p => p.personId === payload.personId);
    this.timeOffPersonId = payload.personId;
    this.timeOffPersonName = person?.name || 'Unknown';
    this.showTimeOffModal = true;
  }

  closeTimeOffModal(): void {
    this.showTimeOffModal = false;
    this.timeOffPersonId = null;
    this.timeOffPersonName = '';
  }

  onSaveTimeOffRequest(request: CreateTimeOffRequest): void {
    if (!this.activeCompany?.companyId) return;
    
    this.timeOffRequestService.createTimeOffRequest(this.activeCompany.companyId, request).subscribe({
      next: (response) => {
        alert('Time off request submitted successfully');
        this.closeTimeOffModal();
        this.loadScheduleData(); // Refresh grid to show changes
      },
      error: (err) => {
        console.error('Failed to submit time off request', err);
        alert(err.error?.message || 'Failed to submit time off request. Please try again.');
      }
    });
  }

  handleReportSick(payload: { personId: number|null; date: Date; note?: string }): void {
    if (!this.activeCompany?.companyId || !payload.personId) return;
    
    // Find the person name from peopleList
    const person = this.peopleList.find(p => p.personId === payload.personId);
    this.sickReportPersonId = payload.personId;
    this.sickReportPersonName = person?.name || 'Unknown';
    this.sickReportDate = payload.date;
    this.showSickReportModal = true;
  }

  closeSickReportModal(): void {
    this.showSickReportModal = false;
    this.sickReportPersonId = null;
    this.sickReportPersonName = '';
    this.sickReportDate = null;
  }

  onSaveSickReport(request: SickReportRequest): void {
    if (!this.activeCompany?.companyId) return;

    // Determine the date range
    const startDate = request.date;
    const endDate = request.isMultiDay && request.endDate ? request.endDate : request.date;

    // Create ShiftEvent with detailed information
    const eventObject = {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      isMultiDay: request.isMultiDay,
      symptoms: request.symptoms,
      requiresDoctor: request.requiresDoctor,
      note: request.note
    };

    const event: ShiftEvent = {
      eventLogId: '',
      eventDate: new Date(),
      eventType: 'sick',
      companyId: this.activeCompany.companyId,
      personId: request.personId,
      eventObject: JSON.stringify(eventObject),
      description: `Sick leave: ${startDate.toLocaleDateString()}${request.isMultiDay ? ' - ' + endDate.toLocaleDateString() : ''}`,
      kioskDevice: null,
      geoLocation: null,
      photoUrl: null
    };

    this.shiftEventService.createShiftEvent(this.activeCompany.companyId, event).subscribe({
      next: () => {
        const days = request.isMultiDay 
          ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
          : 1;
        alert(`Sick leave reported successfully for ${days} day(s). Affected shifts have been marked as open.`);
        this.closeSickReportModal();
        this.loadScheduleData();
      },
      error: (err) => {
        console.error('Failed to report sick', err);
        alert('Failed to report sick. Please try again.');
      }
    });
  }

  handleFindReplacement(payload: { personId: number|null; start: Date; end: Date; locationId: number; areaId: number }): void {
    if (!this.activeCompany?.companyId) return;
    this.replacementContext = payload;
    this.showReplacementPanel = true;
    this.scheduleShiftService.getReplacementCandidatesByWindow(
      this.activeCompany.companyId,
      payload.start,
      payload.end,
      payload.locationId,
      payload.areaId,
      payload.personId ?? undefined
    ).subscribe({
      next: (list) => {
        this.replacementCandidates = list;
      },
      error: (err) => { 
        console.error('Failed to fetch candidates', err); 
        alert('Failed to fetch candidates');
        this.showReplacementPanel = false;
      }
    });
  }

  closeReplacementPanel(): void {
    this.showReplacementPanel = false;
    this.replacementCandidates = [];
    this.replacementContext = null;
  }

  onNotifyCandidate(event: { personId: number; channel: 'push' | 'sms' | 'email' }): void {
    if (!this.activeCompany?.companyId || !this.replacementContext) return;

    // Find the schedule corresponding to the replacement context
    this.scheduleService.getSchedules(this.activeCompany.companyId).subscribe({
      next: (schedules: any[]) => {
        const ctx = this.replacementContext!;
        const match = schedules.find(s =>
          s.personId === ctx.personId &&
          new Date(s.startDate).getTime() === ctx.start.getTime() &&
          new Date(s.endDate).getTime() === ctx.end.getTime()
        );

        if (!match) {
          alert('Could not locate the original shift to create a replacement request.');
          return;
        }

        // Create replacement request then notify selected candidate using selected channel
        this.replacementRequestService.createReplacementRequest(this.activeCompany.companyId, { shiftId: match.scheduleId }).subscribe({
          next: (req) => {
            this.replacementRequestService
              .notifyReplacementCandidates(this.activeCompany!.companyId, req.requestId, { personIds: [event.personId], channel: event.channel })
              .subscribe({
                next: (resp) => {
                  alert(`Notification sent (attempted ${resp.attempted}, succeeded ${resp.succeeded}).`);
                },
                error: (err) => {
                  console.error('Failed to notify candidate', err);
                  alert('Failed to notify candidate.');
                }
              });
          },
          error: (err) => {
            console.error('Failed to create replacement request', err);
            alert('Failed to create replacement request.');
          }
        });
      },
      error: (err) => {
        console.error('Failed to load schedules for notify', err);
        alert('Failed to load schedules.');
      }
    });
  }

  onAssignCandidate(personId: number): void {
    if (!this.activeCompany?.companyId || !this.replacementContext) return;
    if (!confirm(`Assign this shift to ${this.replacementCandidates.find(c => c.personId === personId)?.name ?? 'person'}?`)) return;
    
    const ctx = this.replacementContext;
    const conflict = this.findScheduleConflict(personId, ctx.start, ctx.end);
    if (conflict) {
      this.showConflictModal(this.buildConflictInfo(personId, ctx.start, ctx.end, conflict));
      return;
    }
    const schedule: Schedule = {
      scheduleId: 0,
      name: `Replacement shift for ${ctx.start.toDateString()}`,
      companyId: this.activeCompany.companyId,
      personId: personId,
      startDate: ctx.start,
      endDate: ctx.end,
      locationId: ctx.locationId,
      areaId: ctx.areaId,
      status: 'unpublished',
      timezone: 'UTC'
    } as Schedule;
    
    this.scheduleService.createSchedule(this.activeCompany.companyId, schedule).subscribe({
      next: () => {
        alert('Shift assigned successfully');
        this.closeReplacementPanel();
        this.loadScheduleData();
      },
      error: (err) => {
        console.error('Failed to assign shift', err);
        alert('Failed to assign shift');
      }
    });
  }

  handleRepeatSpecificDays(payload: { baseDate: Date; personId: number|null; locationId: number; areaId: number; start: string; end: string; dayIndices: number[] }): void {
    if (!this.activeCompany?.companyId || !payload.personId) return;
    if (!payload.dayIndices || payload.dayIndices.length === 0) {
      console.warn('repeatSpecificDays called with empty dayIndices');
      return;
    }
    // Compute start of week based on company settings
    const base = new Date(payload.baseDate);
    const startOfWeek = this.getWeekStart(base);
    const createPromises: Promise<any>[] = [];
    for (const idx of payload.dayIndices) {
      const offset = (idx - this.firstDayOfWeek + 7) % 7;
      const d = new Date(startOfWeek);
      d.setUTCDate(startOfWeek.getUTCDate() + offset);
      const startDate = this.buildDateWithTime(d, payload.start);
      const endDate = this.buildDateWithTime(d, payload.end);
      const conflict = this.findScheduleConflict(payload.personId!, startDate, endDate);
      if (conflict) {
        this.showConflictModal(this.buildConflictInfo(payload.personId!, startDate, endDate, conflict));
        return;
      }
      const schedule: Schedule = {
        scheduleId: 0,
        name: `Schedule for ${d.toDateString()}`,
        companyId: this.activeCompany!.companyId,
        personId: payload.personId!,
        startDate,
        endDate,
        locationId: payload.locationId,
        areaId: payload.areaId,
        status: 'unpublished',
        timezone: 'UTC'
      } as Schedule;
      createPromises.push(this.scheduleService.createSchedule(this.activeCompany!.companyId, schedule).toPromise());
    }
    Promise.all(createPromises)
      .then(() => this.loadScheduleData())
      .catch(err => {
        console.error('Failed to repeat on specific days', err);
        alert('Failed to create some schedules for specific days.');
      });
  }

  handleRepeatSetPattern(payload: { personId: number|null; baseDate: Date; locationId: number; areaId: number; start: string; end: string; personName: string }): void {
    if (!this.activeCompany?.companyId || !payload.personId) return;
    
    const person = this.peopleList.find(p => p.personId === payload.personId);
    this.repeatPatternPersonId = payload.personId;
    this.repeatPatternPersonName = person?.name || payload.personName || 'Unknown';
    this.repeatPatternBaseDate = payload.baseDate;
    this.repeatPatternStartTime = payload.start;
    this.repeatPatternEndTime = payload.end;
    this.repeatPatternLocationId = payload.locationId;
    this.repeatPatternAreaId = payload.areaId;
    this.showRepeatPatternModal = true;
  }

  openAddScheduleModal() {
    // Placeholder until the bulk schedule builder is fully implemented.

    // Always sync the clicked cell's date into the bulk form so the date input
    // reflects the cell that was clicked, not a stale value from a previous open.
    if (this.selectedDate) {
      this.bulkStartDate = this.formatDateInput(this.selectedDate);
      this.bulkEndDate = this.bulkStartDate;
    } else {
      // Clear so initBulkFormDefaults falls back to today
      this.bulkStartDate = '';
      this.bulkEndDate = '';
    }
    // Sync the clicked cell's location into the bulk form
    if (this.modalLocationId > 0) {
      this.bulkLocationId = this.modalLocationId;
    }

    this.initBulkFormDefaults();
    // Pre-select the person that was clicked in the grid
    if (this.selectedPersonId != null) {
      this.bulkSelectedPeopleIds = new Set([this.selectedPersonId]);
    }
    this.bulkPeopleSearch = '';
    this.showAddSchedulePlaceholder = true;
    return;

    this.editingSchedule = null;
    // If modalLocationId hasn't been set by onAddShift/onAddEmployeeToLocation, resolve it
    const locId = this.selectedLocationId;
    if (!this.modalLocationId && locId > 0) {
      this.modalLocationId = locId;
    }
    this.showAddScheduleModalFlag = true;
  }
  closeAddSchedulePlaceholder() {
    this.showAddSchedulePlaceholder = false;
    this.bulkError = '';
    this.bulkPeopleSearch = '';
    this.bulkSelectedCrewId = null;
    this.crewAvailability = {};
    this.showNewCrewForm = false;
    this.newCrewName = '';
    // Reset dates so the next open always picks up the freshly clicked cell date
    this.bulkStartDate = '';
    this.bulkEndDate = '';
  }
  closeAddScheduleModal() {
    this.showAddScheduleModalFlag = false;
    this.selectedPersonId = null;
    this.selectedDate = null;
    this.editingSchedule = null;
  }

  openSingleShiftFromPlaceholder() {
    // Capture values before closeAddSchedulePlaceholder() clears them
    const savedStart = this.bulkStartDate;
    const savedLocationId = this.bulkLocationId;
    this.closeAddSchedulePlaceholder();
    const baseDate = savedStart ? new Date(savedStart) : new Date();
    this.selectedDate = baseDate;
    const locationId = savedLocationId ?? this.selectedLocationId ?? 0;
    if (locationId > 0) {
      this.modalLocationId = locationId;
    }
    this.showAddScheduleModalFlag = true;
  }

  getShiftKey(shift: ShiftBlock): string {
    return `${shift.personId}-${shift.startDate.getTime()}`;
  }

  isShiftSelected(shift: ShiftBlock): boolean {
    return this.selectedShifts.has(this.getShiftKey(shift));
  }

  toggleShiftSelection(shift: ShiftBlock, event: Event): void {
    event.stopPropagation();
    const key = this.getShiftKey(shift);
    if (this.selectedShifts.has(key)) {
      this.selectedShifts.delete(key);
    } else {
      this.selectedShifts.add(key);
    }
    this.showBulkActions = this.selectedShifts.size > 0;
  }

  selectAllShifts(): void {
    this.gridData.days.forEach(day => {
      day.shifts.forEach(shift => {
        this.selectedShifts.add(this.getShiftKey(shift));
      });
    });
    this.showBulkActions = this.selectedShifts.size > 0;
  }

  clearSelection(): void {
    this.selectedShifts.clear();
    this.showBulkActions = false;
  }

  copySelectedShifts(): void {
    if (this.selectedShifts.size === 0) return;

    this.copiedShifts = [];
    this.selectedShifts.forEach(shiftKey => {
      const [personIdStr, timestampStr] = shiftKey.split('-');
      const personId = parseInt(personIdStr);
      const timestamp = parseInt(timestampStr);

      // Find the shift in the current data
      for (const day of this.gridData.days) {
        const shift = day.shifts.find(s => 
          s.personId === personId && s.startDate.getTime() === timestamp
        );
        if (shift) {
          this.copiedShifts.push(shift);
          break;
        }
      }
    });

    alert(`${this.copiedShifts.length} shift(s) copied. Click paste button on any date to duplicate.`);
    this.clearSelection();
  }

  pasteShifts(targetDate: Date): void {
    if (this.copiedShifts.length === 0) {
      alert('No shifts copied. Please select and copy shifts first.');
      return;
    }

    const confirmMsg = `Paste ${this.copiedShifts.length} shift(s) to ${targetDate.toLocaleDateString()}?`;
    if (!confirm(confirmMsg)) return;

    // Load full schedules for the copied shifts
    this.scheduleService.getSchedules(this.activeCompany.companyId).subscribe({
      next: (schedules: any[]) => {
        const createPromises: Promise<any>[] = [];

        this.copiedShifts.forEach(copiedShift => {
          // Find the original schedule
          const originalSchedule = schedules.find(s => 
            s.personId === copiedShift.personId && 
            new Date(s.startDate).getTime() === copiedShift.startDate.getTime()
          );

          if (originalSchedule) {
            // Extract time components from original schedule dates
            const originalStartDate = new Date(originalSchedule.startDate);
            const originalEndDate = new Date(originalSchedule.endDate);

            // Create new dates with target date but keep the same wall-clock time from original (UTC)
            const newStartDate = new Date(Date.UTC(
              targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(),
              originalStartDate.getUTCHours(), originalStartDate.getUTCMinutes(), 0
            ));
            const newEndDate = new Date(Date.UTC(
              targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(),
              originalEndDate.getUTCHours(), originalEndDate.getUTCMinutes(), 0
            ));

            const newSchedule: Schedule = {
              scheduleId: 0,
              name: `Schedule for ${targetDate.toDateString()}`,
              companyId: originalSchedule.companyId,
              personId: originalSchedule.personId,
              startDate: newStartDate,
              endDate: newEndDate,
              locationId: originalSchedule.locationId,
              areaId: originalSchedule.areaId,
              status: originalSchedule.status,
              timezone: originalSchedule.timezone,
              crewId: originalSchedule.crewId,
              taskShiftId: originalSchedule.taskShiftId,
              description: originalSchedule.description,
              settings: originalSchedule.settings,
              color: originalSchedule.color,
              externalCode: originalSchedule.externalCode,
              type: originalSchedule.type,
            };

            createPromises.push(
              this.scheduleService.createSchedule(this.activeCompany.companyId, newSchedule).toPromise()
            );
          }
        });

        Promise.all(createPromises).then(() => {
          alert('Shifts pasted successfully!');
          this.loadScheduleData();
        }).catch(err => {
          console.error('Error pasting shifts', err);
          alert('Some shifts failed to paste. Please check the console.');
        });
      },
      error: (err) => {
        console.error('Error loading schedules for paste', err);
        alert('Failed to load schedule data for pasting.');
      }
    });
  }

  bulkUpdateStatus(status: string): void {
    if (this.selectedShifts.size === 0) return;

    const confirmMsg = `Update ${this.selectedShifts.size} shift(s) to ${status}?`;
    if (!confirm(confirmMsg)) return;

    const updates: Promise<any>[] = [];
    
    this.selectedShifts.forEach(shiftKey => {
      const [personIdStr, timestampStr] = shiftKey.split('-');
      const personId = parseInt(personIdStr);
      const timestamp = parseInt(timestampStr);

      // Find the shift in the current data
      let targetShift: ShiftBlock | undefined = undefined;
      for (const day of this.gridData.days) {
        targetShift = day.shifts.find(s => 
          s.personId === personId && s.startDate.getTime() === timestamp
        );
        if (targetShift) break;
      }

      if (targetShift) {
        // Load and update the schedule
        this.scheduleService.getSchedules(this.activeCompany.companyId).subscribe({
          next: (schedules: any[]) => {
            const schedule = schedules.find(s => 
              s.personId === personId && 
              new Date(s.startDate).getTime() === timestamp
            );
            if (schedule) {
              const updatedSchedule = { ...schedule, status };
              updates.push(
                this.scheduleService.updateSchedule(
                  this.activeCompany.companyId, 
                  schedule.scheduleId, 
                  updatedSchedule
                ).toPromise()
              );
            }
          }
        });
      }
    });

    // Wait a bit for all updates to be queued, then reload
    setTimeout(() => {
      this.clearSelection();
      this.loadScheduleData();
    }, 1000);
  }

  voidSelectedShifts(): void {
    if (this.selectedShifts.size === 0) return;

    const confirmMsg = `Void ${this.selectedShifts.size} shift(s)? Voided shifts will be hidden from the grid by default.`;
    if (!confirm(confirmMsg)) return;

    const voidPromises: Promise<any>[] = [];
    const voidedBy = this.activeCompany?.companyId ? `user@${this.activeCompany.companyId}` : 'unknown';

    this.selectedShifts.forEach(shiftKey => {
      const [personIdStr, timestampStr] = shiftKey.split('-');
      const personId = parseInt(personIdStr);
      const timestamp = parseInt(timestampStr);

      const original = this.allSchedules.find(s =>
        s.personId === personId &&
        new Date(s.startDate).getTime() === timestamp
      );

      if (original) {
        voidPromises.push(
          this.scheduleService.voidSchedule(
            this.activeCompany.companyId,
            original.scheduleId,
            voidedBy
          ).toPromise()
        );
      }
    });

    this.loading = true;
    Promise.all(voidPromises)
      .then(() => {
        this.loading = false;
        alert(`${voidPromises.length} shift(s) voided successfully.`);
        this.clearSelection();
        this.loadScheduleData();
      })
      .catch(err => {
        this.loading = false;
        console.error('Error voiding shifts:', err);
        alert('Failed to void some shifts. Please check the console.');
      });
  }

  toggleShowVoidRecords(): void {
    this.showVoidRecords = !this.showVoidRecords;
    this.loadScheduleData();
  }
  activeCompany$: Observable<any>;
  activeCompany: any;
  
  gridData: ScheduleGridData = {
    weekStart: new Date(),
    weekEnd: new Date(),
    locationName: 'Loading...',
    teamMembers: [],
    days: [],
    stats: {
      empty: 0,
      unpublished: 0,
      published: 0,
      requireConfirmation: 0,
      openShifts: 0,
      warnings: 0,
      leaveApproved: 0,
      leavePending: 0,
      unavailable: 0
    }
  };

  filters: ScheduleFilters = {
    searchQuery: '',
    shiftTypes: [],
    trainingTypes: [],
    sortBy: 'name'
  };

  loading = false;
  error: any = null;
  showFilterModal = false;
  currentWeekStart: Date = new Date();
  locations: any[] = [];
  selectedLocationId: number = 0;
  peopleList: People[] = [];
  replacementCandidates: ReplacementCandidate[] = [];
  showReplacementPanel: boolean = false;
  replacementContext: { start: Date; end: Date; locationId: number; areaId: number; personId: number | null } | null = null;
  showTimeOffModal: boolean = false;
  timeOffPersonId: number | null = null;
  timeOffPersonName: string = '';
  showSickReportModal: boolean = false;
  sickReportPersonId: number | null = null;
  sickReportPersonName: string = '';
  sickReportDate: Date | null = null;
  showRepeatPatternModal: boolean = false;
  repeatPatternPersonId: number | null = null;
  repeatPatternPersonName: string = '';
  repeatPatternBaseDate: Date = new Date();
  repeatPatternStartTime: string = '09:00';
  repeatPatternEndTime: string = '17:00';
  repeatPatternLocationId: number = 0;
  repeatPatternAreaId: number = 0;
  showShiftHistoryModal: boolean = false;
  historyPersonId: number | null = null;
  historyPersonName: string = '';
  /** Populated to open the rich conflict modal; null when closed. */
  conflictModalInfo: ScheduleConflictInfo | null = null;
  firstDayOfWeek: 0 | 1 = 0;
  horizonRange: HorizonRange = 'week';

  get horizonDays(): number {
    switch (this.horizonRange) {
      case '2-weeks': return 14;
      case '3-weeks': return 21;
      case '4-weeks': return 28;
      default: return 7;
    }
  }

  allSchedules: Schedule[] = [];
  viewMode: ViewMode = 'single';
  locationGroups: LocationGroup[] = [];
  modalLocationId: number = 0;
  allDropListIds: string[] = [];
  dragInProgress: boolean = false;
  showVoidRecords: boolean = false;
  areas: Area[] = [];
  bulkLocationId: number | null = null;
  bulkAreaId: number | null = null;
  bulkStartDate: string = '';
  bulkEndDate: string = '';
  bulkStartTime: string = '09:00';
  bulkEndTime: string = '17:00';
  bulkSelectedPeopleIds: Set<number> = new Set();
  bulkCreating: boolean = false;
  bulkError: string = '';
  bulkPeopleSearch: string = '';
  crews: Crew[] = [];
  bulkSelectedCrewId: number | null = null;
  crewAvailability: { [personId: number]: CrewMemberAvailability } = {};
  checkingCrewAvailability: boolean = false;
  showNewCrewForm: boolean = false;
  newCrewName: string = '';
  creatingCrew: boolean = false;

  get filteredBulkPeopleList(): People[] {
    const q = this.bulkPeopleSearch.toLowerCase().trim();
    if (!q) return this.peopleList;
    return this.peopleList.filter(p => p.name.toLowerCase().includes(q));
  }

  constructor(
    private store: Store<AppState>,
    private scheduleService: ScheduleService,
    private scheduleShiftService: ScheduleShiftService,
    private peopleService: PeopleService,
    private locationService: LocationService,
    private areaService: AreaService,
    private shiftEventService: ShiftEventService,
    private timeOffRequestService: TimeOffRequestService,
    private replacementRequestService: ReplacementRequestService,
    private settingsHelper: SettingsHelperService,
    private crewService: CrewService,
    private router: Router
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.activeCompany$.subscribe(company => {
      if (company) {
        this.activeCompany = company;
        this.settingsHelper.loadSettings(String(company.companyId)).subscribe({
          next: (settings) => {
            this.firstDayOfWeek = this.settingsHelper.getFirstDayOfWeek(settings);
            this.initializeWeek();
            this.locationService.getLocations(company.companyId).subscribe(locations => {
              this.locations = locations;
              if (locations.length > 0) {
                this.selectedLocationId = locations[0].locationId;
                this.gridData.locationName = locations[0].name;
              }
              this.loadAreas(company.companyId);
              this.loadScheduleData();
            });
          },
          error: () => {
            this.firstDayOfWeek = 0;
            this.initializeWeek();
            this.locationService.getLocations(company.companyId).subscribe(locations => {
              this.locations = locations;
              if (locations.length > 0) {
                this.selectedLocationId = locations[0].locationId;
                this.gridData.locationName = locations[0].name;
              }
              this.loadAreas(company.companyId);
              this.loadScheduleData();
            });
          }
        });
        this.loadCrews(String(company.companyId));
      }
    });
  }

  private loadAreas(companyId: string): void {
    this.areaService.getAreas(companyId).subscribe({
      next: (areas) => {
        this.areas = areas;
        this.syncBulkAreaWithLocation();
      },
      error: () => {
        this.areas = [];
      }
    });
  }

  private loadCrews(companyId: string): void {
    this.crewService.getCrews(companyId).subscribe({
      next: (crews) => { this.crews = crews; },
      error: () => { this.crews = []; }
    });
  }

  toggleNewCrewForm(): void {
    this.showNewCrewForm = !this.showNewCrewForm;
    if (!this.showNewCrewForm) {
      this.newCrewName = '';
    }
  }

  createCrewInline(): void {
    const name = this.newCrewName.trim();
    if (!name || !this.activeCompany || this.creatingCrew) return;
    this.creatingCrew = true;
    this.crewService.createCrew(String(this.activeCompany.companyId), name).subscribe({
      next: (crew) => {
        this.crews = [...this.crews, crew];
        this.bulkSelectedCrewId = crew.crewId;
        this.showNewCrewForm = false;
        this.newCrewName = '';
        this.creatingCrew = false;
        this.onBulkCrewChange();
      },
      error: () => {
        this.creatingCrew = false;
        this.bulkError = 'Failed to create crew. Please try again.';
      }
    });
  }

  onBulkCrewChange(): void {
    if (!this.bulkSelectedCrewId || !this.activeCompany) {
      this.crewAvailability = {};
      return;
    }
    if (!this.bulkStartDate || !this.bulkEndDate) {
      return;
    }
    const startDateTime = this.bulkStartTime
      ? `${this.bulkStartDate}T${this.bulkStartTime}:00`
      : `${this.bulkStartDate}T00:00:00`;
    const endDateTime = this.bulkEndTime
      ? `${this.bulkEndDate}T${this.bulkEndTime}:00`
      : `${this.bulkEndDate}T23:59:59`;
    this.checkingCrewAvailability = true;
    this.crewAvailability = {};
    this.crewService
      .getCrewAvailability(
        String(this.activeCompany.companyId),
        this.bulkSelectedCrewId,
        startDateTime,
        endDateTime
      )
      .subscribe({
        next: (availability) => {
          const map: { [personId: number]: CrewMemberAvailability } = {};
          const idsToSelect = new Set<number>(this.bulkSelectedPeopleIds);
          availability.forEach(a => {
            map[a.personId] = a;
            if (a.available) {
              idsToSelect.add(a.personId);
            }
          });
          this.crewAvailability = map;
          this.bulkSelectedPeopleIds = idsToSelect;
          this.checkingCrewAvailability = false;
        },
        error: () => {
          this.checkingCrewAvailability = false;
        }
      });
  }

  initializeWeek(): void {
    const today = new Date();
    this.currentWeekStart = this.getWeekStart(today);
  }

  private getWeekStart(date: Date): Date {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayOfWeek = start.getUTCDay();
    const diff = (dayOfWeek - this.firstDayOfWeek + 7) % 7;
    start.setUTCDate(start.getUTCDate() - diff);
    return start;
  }

  loadScheduleData(): void {
    if (!this.activeCompany?.companyId) return;

    this.loading = true;
    this.error = null;

    const weekEnd = new Date(this.currentWeekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + this.horizonDays);

    this.peopleService.getPeople(this.activeCompany.companyId).subscribe({
      next: (people: People[]) => {
        this.peopleList = people;
        this.scheduleService.getSchedulesPaged(
          this.activeCompany.companyId,
          this.currentWeekStart.toISOString(),
          weekEnd.toISOString(),
          1,
          500,
          undefined,
          undefined,
          undefined,
          this.showVoidRecords
        ).subscribe({
          next: (result) => {
            this.allSchedules = result.items || [];
            this.buildGridData(people, this.allSchedules);
            this.rebuildDropListIds();
            this.loading = false;
          },
          error: (err: any) => {
            this.error = err;
            this.loading = false;
          }
        });
      },
      error: (err: any) => {
        this.error = err;
        this.loading = false;
      }
    });
  }

  buildGridData(people: People[], shifts: ScheduleShift[]): void {
    // Filter shifts for single-location mode
    let filteredShifts = shifts;
    let filteredPeople = people;

    if (this.viewMode === 'single' && this.selectedLocationId > 0) {
      filteredShifts = shifts.filter(s => s.locationId === this.selectedLocationId);
      // Only show people who have at least one shift at this location
      const personIdsWithShifts = new Set(filteredShifts.map(s => s.personId));
      filteredPeople = people.filter(p => personIdsWithShifts.has(p.personId));
    }

    // Build 7 days for the week
    const days: DaySchedule[] = this.buildDays(filteredShifts, filteredPeople);

    // Build team members with hours
    const teamMembers: TeamMember[] = this.buildTeamMembers(filteredPeople, filteredShifts);

    // Calculate stats from filteredShifts
    const totalCells = days.length * teamMembers.length;
    const filledCells = filteredShifts.length;
    const published = filteredShifts.filter(s => s.status.toLowerCase() === 'published').length;
    const unpublished = filteredShifts.filter(s => s.status.toLowerCase() !== 'published').length;
    const selectedLocation = this.locations.find(l => l.locationId === this.selectedLocationId);

    this.gridData = {
      weekStart: this.currentWeekStart,
      weekEnd: new Date(this.currentWeekStart.getTime() + this.horizonDays * 24 * 60 * 60 * 1000),
      locationName: this.viewMode === 'grouped' ? 'All Locations (Grouped)' 
                   : this.viewMode === 'all' ? 'All Employees'
                   : (selectedLocation ? selectedLocation.name : ''),
      teamMembers: this.applyFilters(teamMembers),
      days,
      stats: {
        empty: totalCells - filledCells,
        unpublished,
        published,
        requireConfirmation: 0,
        openShifts: 0,
        warnings: 0,
        leaveApproved: 0,
        leavePending: 0,
        unavailable: 0
      }
    };

    // Build location groups for grouped mode
    if (this.viewMode === 'grouped') {
      this.buildLocationGroups(people, shifts);
    } else {
      this.locationGroups = [];
    }
  }

  /** Build DaySchedule[] for the current horizon period from the given shifts */
  private buildDays(shifts: ScheduleShift[], people: People[]): DaySchedule[] {
    const days: DaySchedule[] = [];
    for (let i = 0; i < this.horizonDays; i++) {
      const date = new Date(this.currentWeekStart);
      date.setUTCDate(date.getUTCDate() + i);
      const dayShifts = shifts.filter(s => {
        const shiftDate = new Date(s.startDate);
        // Compare using UTC date components to avoid timezone-shifted day mismatches
        return shiftDate.getUTCFullYear() === date.getUTCFullYear()
          && shiftDate.getUTCMonth() === date.getUTCMonth()
          && shiftDate.getUTCDate() === date.getUTCDate();
      });
      const shiftBlocks: ShiftBlock[] = dayShifts.map(s => {
        const person = people.find(p => p.personId === s.personId);
        const now = new Date();
        const startDate = new Date(s.startDate);
        const endDate = new Date(s.endDate);
        const isOnShift = !!person?.statusShiftWork && person.statusShiftWork.startsWith('OnShift');
        const isWithinWindow = now >= startDate && now <= endDate;
        const isCompleted = now > endDate || (!!s.status && s.status.toLowerCase() === 'locked');
        return {
          scheduleShiftId: s.scheduleShiftId || 0,
          personId: s.personId,
          personName: person?.name || `Person ${s.personId}`,
          startTime: this.formatTime(startDate),
          endTime: this.formatTime(endDate),
          startDate,
          endDate,
          locationId: s.locationId,
          locationName: this.locations.find(l => l.locationId === s.locationId)?.name,
          areaName: undefined,
          status: this.mapStatus(s.status),
          isLocked: s.status.toLowerCase() === 'locked',
          voidedBy: (s as any).voidedBy,
          voidedAt: (s as any).voidedAt ? new Date((s as any).voidedAt) : undefined,
          isOnShiftNow: isOnShift && isWithinWindow,
          isCompleted
        };
      });
      const UTC_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      days.push({
        date,
        dayName: `${UTC_DAYS[date.getUTCDay()]} ${date.getUTCDate()}`,
        unavailableCount: 0,
        shifts: shiftBlocks
      });
    }
    return days;
  }

  /** Build TeamMember[] with total hours calculated from the given shifts */
  private buildTeamMembers(people: People[], shifts: ScheduleShift[]): TeamMember[] {
    return people.map(p => {
      const personShifts = shifts.filter(s => s.personId === p.personId);
      const totalMinutes = personShifts.reduce((sum, s) => {
        const start = new Date(s.startDate).getTime();
        const end = new Date(s.endDate).getTime();
        return sum + (end - start) / (1000 * 60);
      }, 0);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.floor(totalMinutes % 60);
      return {
        personId: p.personId,
        initials: this.getInitials(p.name),
        fullName: p.name,
        totalHours: `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`,
        profilePhotoUrl: p.photoUrl
      };
    });
  }

  /** Build location groups for the grouped view mode */
  private buildLocationGroups(people: People[], shifts: ScheduleShift[]): void {
    this.locationGroups = this.locations.map(loc => {
      const locShifts = shifts.filter(s => s.locationId === loc.locationId);
      const personIdsAtLocation = [...new Set(locShifts.map(s => s.personId))];
      const locPeople = people.filter(p => personIdsAtLocation.includes(p.personId));

      return {
        locationId: loc.locationId,
        locationName: loc.name,
        teamMembers: this.applyFilters(this.buildTeamMembers(locPeople, locShifts)),
        days: this.buildDays(locShifts, locPeople)
      };
    }).filter(g => g.teamMembers.length > 0); // Only show locations that have scheduled people
  }

  /**
   * Returns true when two Date objects fall on the same UTC calendar day.
   * ALWAYS use this instead of toDateString() for day comparisons — toDateString()
   * converts to local time first, which shifts UTC-midnight dates to the previous
   * day in negative-offset timezones (e.g. UTC-1 through UTC-12).
   */
  private sameUTCDay(a: Date, b: Date): boolean {
    return a.getUTCFullYear() === b.getUTCFullYear()
      && a.getUTCMonth() === b.getUTCMonth()
      && a.getUTCDate() === b.getUTCDate();
  }

  /** Get shifts for a person on a given day within a specific location group */
  getShiftsForPersonDayAndLocation(personId: number, date: Date, locationId: number): ShiftBlock[] {
    const group = this.locationGroups.find(g => g.locationId === locationId);
    if (!group) return [];
    // Use sameUTCDay — never toDateString() — to avoid local-timezone day shifts.
    const day = group.days.find(d => this.sameUTCDay(d.date, date));
    return day?.shifts.filter(s => s.personId === personId) || [];
  }

  /** Check for cross-location time overlap in grouped mode */
  hasCrossLocationConflict(personId: number, startDate: Date, endDate: Date, ignoreScheduleId?: number): boolean {
    return this.allSchedules.some(existing => {
      if (existing.personId !== personId) return false;
      if (ignoreScheduleId && existing.scheduleId === ignoreScheduleId) return false;
      const existingStart = new Date(existing.startDate);
      const existingEnd = new Date(existing.endDate);
      return startDate < existingEnd && existingStart < endDate;
    });
  }

  /** Add a new employee (person) to a location in single or grouped mode */
  onAddEmployeeToLocation(locationId?: number): void {
    this.editingSchedule = null;
    this.selectedPersonId = null;
    this.selectedDate = new Date(this.currentWeekStart); // Default to first day of week
    // Resolve the location for the modal
    if (locationId) {
      this.modalLocationId = locationId;
    } else if (this.viewMode === 'single' && this.selectedLocationId > 0) {
      this.modalLocationId = this.selectedLocationId;
    } else {
      this.modalLocationId = 0;
    }
    this.openAddScheduleModal();
  }

  /** Generate a unique drop-list ID for a day cell */
  getCellDropId(personId: number, dayIndex: number, locationId?: number): string {
    return locationId
      ? `cell-${locationId}-${personId}-${dayIndex}`
      : `cell-${personId}-${dayIndex}`;
  }

  /** Rebuild the master list of all connected drop-list IDs */
  private rebuildDropListIds(): void {
    const ids: string[] = [];
    if (this.viewMode === 'grouped') {
      this.locationGroups.forEach(group => {
        group.teamMembers.forEach(member => {
          for (let i = 0; i < this.horizonDays; i++) {
            ids.push(this.getCellDropId(member.personId, i, group.locationId));
          }
        });
      });
    } else {
      this.gridData.teamMembers.forEach(member => {
        for (let i = 0; i < this.horizonDays; i++) {
          ids.push(this.getCellDropId(member.personId, i));
        }
      });
    }
    this.allDropListIds = ids;
  }

  /** Handle a shift block being dropped onto a new day cell */
  onShiftDrop(event: CdkDragDrop<{ personId: number; date: Date; locationId?: number }, any, ShiftBlock>): void {
    if (event.previousContainer === event.container) return;

    const shift: ShiftBlock = event.item.data;
    const targetDate: Date = event.container.data.date;

    const original = this.allSchedules.find(s =>
      s.personId === shift.personId &&
      new Date(s.startDate).getTime() === shift.startDate.getTime()
    );
    if (!original) {
      console.error('Could not find original schedule for dropped shift');
      return;
    }

    // Keep same UTC wall-clock hours, change only the date
    const origStart = new Date(original.startDate);
    const origEnd = new Date(original.endDate);
    const newStartDate = new Date(Date.UTC(
      targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(),
      origStart.getUTCHours(), origStart.getUTCMinutes(), 0
    ));
    const newEndDate = new Date(Date.UTC(
      targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(),
      origEnd.getUTCHours(), origEnd.getUTCMinutes(), 0
    ));

    if (this.hasScheduleConflict(original.personId, newStartDate, newEndDate, original.scheduleId)) {
      const dropConflict = this.findScheduleConflict(original.personId, newStartDate, newEndDate, original.scheduleId)!;
      this.showConflictModal(this.buildConflictInfo(original.personId, newStartDate, newEndDate, dropConflict, original.scheduleId));
      return;
    }

    const updatedSchedule = { ...original, startDate: newStartDate, endDate: newEndDate };

    this.loading = true;
    this.scheduleService.updateSchedule(this.activeCompany.companyId, original.scheduleId, updatedSchedule).subscribe({
      next: () => {
        this.loading = false;
        this.loadScheduleData();
      },
      error: (err) => {
        this.loading = false;
        console.error('Failed to move shift', err);
        alert('Failed to move shift. Please try again.');
      }
    });
  }

  applyFilters(members: TeamMember[]): TeamMember[] {
    let filtered = [...members];

    if (this.filters.searchQuery) {
      const query = this.filters.searchQuery.toLowerCase();
      filtered = filtered.filter(m => m.fullName.toLowerCase().includes(query));
    }

    return filtered;
  }

  onHorizonChange(range: HorizonRange): void {
    this.horizonRange = range;
    this.loadScheduleData();
  }

  onLocationChange(): void {
    if (this.selectedLocationId === -1) {
      this.viewMode = 'grouped';
      this.gridData.locationName = 'All Locations (Grouped)';
    } else if (this.selectedLocationId === 0) {
      this.viewMode = 'all';
      this.gridData.locationName = 'All Employees';
    } else {
      this.viewMode = 'single';
      const selectedLocation = this.locations.find(l => l.locationId === this.selectedLocationId);
      this.gridData.locationName = selectedLocation ? selectedLocation.name : '';
    }
    this.loadScheduleData();
  }

  onBulkLocationChange(): void {
    this.syncBulkAreaWithLocation();
  }

  private initBulkFormDefaults(): void {
    const today = new Date();
    if (!this.bulkStartDate) {
      this.bulkStartDate = this.formatDateInput(today);
    }
    if (!this.bulkEndDate) {
      this.bulkEndDate = this.bulkStartDate;
    }
    if (!this.bulkLocationId || this.bulkLocationId <= 0) {
      const firstLocation = this.locations.find(loc => loc.locationId > 0);
      if (firstLocation) {
        this.bulkLocationId = firstLocation.locationId;
      }
    }
    this.syncBulkAreaWithLocation();
  }

  private formatDateInput(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getAreasForLocation(locationId: number | null): Area[] {
    if (!locationId || locationId <= 0) {
      return [];
    }
    return this.areas.filter(area => String(area.locationId ?? '') === String(locationId));
  }

  private syncBulkAreaWithLocation(): void {
    const areasForLocation = this.getAreasForLocation(this.bulkLocationId);
    if (areasForLocation.length === 0) {
      this.bulkAreaId = null;
      return;
    }
    if (!this.bulkAreaId || !areasForLocation.some(area => area.areaId === this.bulkAreaId)) {
      this.bulkAreaId = areasForLocation[0].areaId;
    }
  }

  toggleBulkPersonSelection(personId: number, checked: boolean): void {
    if (checked) {
      this.bulkSelectedPeopleIds.add(personId);
    } else {
      this.bulkSelectedPeopleIds.delete(personId);
    }
  }

  selectAllBulkPeople(): void {
    // Select only the currently visible (filtered) people
    this.filteredBulkPeopleList.forEach(person => this.bulkSelectedPeopleIds.add(person.personId));
  }

  clearBulkPeopleSelection(): void {
    this.bulkSelectedPeopleIds.clear();
  }

  async createBulkSchedules(): Promise<void> {
    if (!this.activeCompany?.companyId) return;
    this.bulkError = '';

    if (!this.bulkLocationId || this.bulkLocationId <= 0) {
      this.bulkError = 'Select a location.';
      return;
    }
    if (!this.bulkAreaId || this.bulkAreaId <= 0) {
      this.bulkError = 'Select an area for the location.';
      return;
    }
    if (!this.bulkStartDate || !this.bulkEndDate) {
      this.bulkError = 'Select a valid date range.';
      return;
    }
    if (!this.bulkStartTime || !this.bulkEndTime) {
      this.bulkError = 'Select a start and end time.';
      return;
    }
    if (this.bulkSelectedPeopleIds.size === 0) {
      this.bulkError = 'Select at least one person.';
      return;
    }

    const start = new Date(this.bulkStartDate);
    const end = new Date(this.bulkEndDate);
    if (end < start) {
      this.bulkError = 'End date must be on or after start date.';
      return;
    }

    this.bulkCreating = true;
    let createdCount = 0;
    let skippedCount = 0;
    const skippedEntries: BulkSkippedEntry[] = [];

    const dates = this.getBulkDateRange(start, end);
    for (const date of dates) {
      const startDate = this.createDateWithTimeUTC(date, this.bulkStartTime);
      const endDate = this.createDateWithTimeUTC(date, this.bulkEndTime);
      for (const personId of this.bulkSelectedPeopleIds) {
        const conflict = this.findScheduleConflict(personId, startDate, endDate);
        if (conflict) {
          skippedCount++;
          const csLoc = this.locations.find(l => l.locationId === conflict.locationId)?.name ?? `Location ${conflict.locationId}`;
          const csEnd = new Date(conflict.endDate);
          skippedEntries.push({
            personName: this.getPersonName(personId),
            date: new Date(startDate),
            reason: `Overlaps existing shift ending ${this.fmtUTCShort(csEnd)} at ${csLoc}`
          });
          continue;
        }

        const schedule: Schedule = {
          scheduleId: 0,
          name: `Bulk schedule for ${date.toDateString()}`,
          companyId: this.activeCompany.companyId,
          personId,
          locationId: this.bulkLocationId,
          areaId: this.bulkAreaId,
          startDate,
          endDate,
          status: 'unpublished',
          timezone: 'UTC'
        } as Schedule;

        try {
          await lastValueFrom(this.scheduleService.createSchedule(this.activeCompany.companyId, schedule));
          createdCount++;
        } catch (error) {
          console.error('Failed to create bulk schedule', error);
          skippedCount++;
          skippedEntries.push({
            personName: this.getPersonName(personId),
            date: new Date(startDate),
            reason: 'Server error — see console for details'
          });
        }
      }
    }

    this.bulkCreating = false;
    this.loadScheduleData();
    if (skippedCount > 0) {
      // Keep the bulk modal open so the user can review and adjust — only show the conflict summary
      this.showConflictModal({
        personName: '',
        requestedStart: new Date(),
        requestedEnd: new Date(),
        conflictingShift: null,
        violations: [],
        bulkSummary: {
          createdCount,
          skippedCount,
          skipped: skippedEntries
        }
      });
    } else {
      // All shifts created successfully — close the bulk modal
      this.closeAddSchedulePlaceholder();
    }
  }

  private getBulkDateRange(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    // Use UTC methods so date-only strings ("2026-03-12") parsed as UTC midnight
    // don't shift to the previous local day in negative-offset timezones.
    const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endMs = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    while (current.getTime() <= endMs) {
      dates.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
  }

  onSaveSchedule(schedule: Schedule): void {
    if (schedule.personId) {
      const ignoreId = this.editingSchedule?.scheduleId;
      const saveConflict = this.findScheduleConflict(schedule.personId, new Date(schedule.startDate), new Date(schedule.endDate), ignoreId);
      if (saveConflict) {
        this.showConflictModal(this.buildConflictInfo(schedule.personId, new Date(schedule.startDate), new Date(schedule.endDate), saveConflict, ignoreId));
        return;
      }
    }
    if (this.editingSchedule && this.editingSchedule.scheduleId) {
      // Update existing schedule
      this.scheduleService.updateSchedule(this.activeCompany.companyId, this.editingSchedule.scheduleId, schedule).subscribe({
        next: (updatedSchedule) => {
          console.log('Schedule updated successfully', updatedSchedule);
          this.closeAddScheduleModal();
          this.loadScheduleData();
        },
        error: (err) => {
          console.error('Error updating schedule', err);
          alert('Failed to update schedule. Please try again.');
        }
      });
    } else {
      // Create new schedule
      this.scheduleService.createSchedule(this.activeCompany.companyId, schedule).subscribe({
        next: (createdSchedule) => {
          console.log('Schedule created successfully', createdSchedule);
          this.closeAddScheduleModal();
          this.loadScheduleData();
        },
        error: (err) => {
          console.error('Error creating schedule', err);
          alert('Failed to create schedule. Please try again.');
        }
      });
    }
  }

  getInitials(name: string): string {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  formatTime(date: Date): string {
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : '';
    return `${displayHours}${displayMinutes}${ampm}`;
  }

  mapStatus(status: string): 'published' | 'unpublished' | 'locked' | 'open' | 'void' {
    const s = status.toLowerCase();
    if (s === 'void') return 'void';
    if (s === 'locked') return 'locked';
    if (s === 'published') return 'published';
    if (s === 'open') return 'open';
    return 'unpublished';
  }

  getShiftColor(status: string): string {
    switch (status) {
      case 'published': return '#C8E6C9';
      case 'locked': return '#C8E6C9';
      case 'unpublished': return '#FFF9C4';
      case 'open': return '#E1BEE7';
      case 'void': return '#FFCDD2';
      default: return '#E0E0E0';
    }
  }

  isShiftLate(shift: ShiftBlock): boolean {
    if (shift.isOnShiftNow) return false;
    const now = new Date();
    return now >= shift.startDate && now <= shift.endDate;
  }

  getShiftClockTooltip(shift: ShiftBlock): string {
    return this.isShiftLate(shift) ? 'Delayed: not clocked in' : 'OnShift';
  }

  getShiftsForPersonAndDay(personId: number, date: Date): ShiftBlock[] {
    // Use sameUTCDay — never toDateString() — to avoid local-timezone day shifts.
    const day = this.gridData.days.find(d => this.sameUTCDay(d.date, date));
    return day?.shifts.filter(s => s.personId === personId) || [];
  }

  onShiftClick(shift: ShiftBlock): void {
    // Find the full schedule from the loaded data
    this.scheduleService.getSchedules(this.activeCompany.companyId).subscribe({
      next: (schedules: any[]) => {
        const schedule = schedules.find(s => 
          s.personId === shift.personId && 
          new Date(s.startDate).getTime() === shift.startDate.getTime()
        );
        if (schedule) {
          this.editingSchedule = schedule;
          this.selectedPersonId = schedule.personId;
          this.selectedDate = new Date(schedule.startDate);
          this.modalLocationId = schedule.locationId || (shift.locationId ?? 0);
          this.showAddScheduleModalFlag = true;
        }
      },
      error: (err) => {
        console.error('Error loading schedule for edit', err);
        alert('Unable to load schedule details');
      }
    });
  }

  onAddShift(personId: number, date: Date, locationId?: number): void {
    this.editingSchedule = null;
    this.selectedPersonId = personId;
    this.selectedDate = date;
    // Resolve the location for the modal based on view mode
    if (locationId) {
      this.modalLocationId = locationId;
    } else if (this.viewMode === 'single' && this.selectedLocationId > 0) {
      this.modalLocationId = this.selectedLocationId;
    } else {
      this.modalLocationId = 0;
    }
    this.openAddScheduleModal();
  }

  onPreviousPeriod(): void {
    const newDate = new Date(this.currentWeekStart);
    newDate.setUTCDate(newDate.getUTCDate() - this.horizonDays);
    this.currentWeekStart = newDate;
    this.loadScheduleData();
  }

  onNextPeriod(): void {
    const newDate = new Date(this.currentWeekStart);
    newDate.setUTCDate(newDate.getUTCDate() + this.horizonDays);
    this.currentWeekStart = newDate;
    this.loadScheduleData();
  }

  onFilterChange(): void {
    if (this.activeCompany?.companyId) {
      this.loadScheduleData();
    }
  }

  toggleFilterModal(): void {
    this.showFilterModal = !this.showFilterModal;
  }

  clearFilters(): void {
    this.filters = {
      searchQuery: '',
      shiftTypes: [],
      trainingTypes: [],
      sortBy: 'name'
    };
    this.onFilterChange();
  }

  removeShiftTypeFilter(type: string): void {
    this.filters.shiftTypes = this.filters.shiftTypes?.filter(t => t !== type) || [];
    this.onFilterChange();
  }

  removeTrainingFilter(type: string): void {
    this.filters.trainingTypes = this.filters.trainingTypes?.filter(t => t !== type) || [];
    this.onFilterChange();
  }

  get activeFilterCount(): number {
    return (this.filters.shiftTypes?.length || 0) + (this.filters.trainingTypes?.length || 0);
  }

  onPublishAllShifts(): void {
    if (!this.activeCompany?.companyId) return;
    
    const unpublishedCount = this.gridData.stats.unpublished;
    if (unpublishedCount === 0) return;

    const confirmMsg = `Publish ${unpublishedCount} unpublished shift${unpublishedCount > 1 ? 's' : ''}?`;
    if (!confirm(confirmMsg)) return;

    this.loading = true;

    // Get all schedules for the current period
    this.scheduleService.getSchedules(this.activeCompany.companyId).subscribe({
      next: (schedules: any[]) => {
        // Filter unpublished schedules within the current period
        const weekStart = new Date(this.currentWeekStart);
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekStart.getUTCDate() + this.horizonDays);

        const unpublishedSchedules = schedules.filter(s => {
          const scheduleDate = new Date(s.startDate);
          return s.status === 'unpublished' && 
                 scheduleDate >= weekStart && 
                 scheduleDate < weekEnd;
        });

        if (unpublishedSchedules.length === 0) {
          this.loading = false;
          alert('No unpublished schedules found for this period.');
          return;
        }

        // Update each schedule to published status
        const updatePromises = unpublishedSchedules.map(schedule => {
          const updatedSchedule = { ...schedule, status: 'published' };
          return this.scheduleService.updateSchedule(
            this.activeCompany.companyId,
            schedule.scheduleId,
            updatedSchedule
          ).toPromise();
        });

        Promise.all(updatePromises)
          .then(() => {
            this.loading = false;
            alert(`Successfully published ${unpublishedSchedules.length} shift(s)!`);
            this.loadScheduleData();
          })
          .catch(err => {
            this.loading = false;
            console.error('Error publishing schedules:', err);
            alert('Failed to publish some schedules. Please try again.');
          });
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading schedules:', err);
        alert('Failed to load schedules. Please try again.');
      }
    });
  }

  closeRepeatPatternModal(): void {
    this.showRepeatPatternModal = false;
    this.repeatPatternPersonId = null;
    this.repeatPatternPersonName = '';
  }

  onViewShiftHistory(payload: { personId: number; personName: string }): void {
    this.historyPersonId = payload.personId;
    this.historyPersonName = payload.personName;
    this.showShiftHistoryModal = true;
    // Close the add/edit modal if open
    this.closeAddScheduleModal();
  }

  closeShiftHistoryModal(): void {
    this.showShiftHistoryModal = false;
    this.historyPersonId = null;
    this.historyPersonName = '';
  }

  onSaveRepeatPattern(request: RepeatPatternRequest): void {
    if (!this.activeCompany?.companyId) return;

    const dates = this.generateDatesFromPattern(request);
    
    if (dates.length === 0) {
      alert('No dates generated from pattern. Please check your settings.');
      return;
    }

    for (const date of dates) {
      const startDate = this.buildDateWithTime(date, request.startTime);
      const endDate = this.buildDateWithTime(date, request.endTime);
      const patternConflict = this.findScheduleConflict(request.personId, startDate, endDate);
      if (patternConflict) {
        this.showConflictModal(this.buildConflictInfo(request.personId, startDate, endDate, patternConflict));
        return;
      }
    }

    const confirmMsg = `This will create ${dates.length} shift(s). Continue?`;
    if (!confirm(confirmMsg)) return;

    this.loading = true;

    const createPromises = dates.map(date => {
      const startDate = this.buildDateWithTime(date, request.startTime);
      const endDate = this.buildDateWithTime(date, request.endTime);

      const schedule: Schedule = {
        scheduleId: 0,
        name: `Recurring shift for ${date.toDateString()}`,
        companyId: this.activeCompany.companyId,
        personId: request.personId,
        startDate,
        endDate,
        locationId: request.locationId,
        areaId: request.areaId,
        status: 'unpublished',
        timezone: 'UTC'
      } as Schedule;

      return this.scheduleService.createSchedule(this.activeCompany.companyId, schedule).toPromise();
    });

    Promise.all(createPromises)
      .then(() => {
        this.loading = false;
        alert(`Successfully created ${dates.length} shift(s)!`);
        this.closeRepeatPatternModal();
        this.loadScheduleData();
      })
      .catch(err => {
        this.loading = false;
        console.error('Error creating pattern shifts:', err);
        alert('Failed to create some shifts. Please check the console.');
      });
  }

  generateDatesFromPattern(request: RepeatPatternRequest): Date[] {
    const dates: Date[] = [];
    const pattern = request.pattern;
    const baseDate = new Date(request.baseDate);
    // Use UTC midnight to avoid local-timezone day shifts
    baseDate.setUTCHours(0, 0, 0, 0);

    // Determine end condition
    let endDate: Date | null = null;
    let maxOccurrences = pattern.occurrences || 52; // Default to 52 if not specified

    if (pattern.endDate) {
      endDate = new Date(pattern.endDate);
      endDate.setUTCHours(23, 59, 59, 999);
    }

    let currentDate = new Date(baseDate);
    let occurrenceCount = 0;

    switch (pattern.patternType) {
      case 'daily':
        while (occurrenceCount < maxOccurrences && (!endDate || currentDate <= endDate)) {
          dates.push(new Date(currentDate));
          currentDate.setUTCDate(currentDate.getUTCDate() + (pattern.repeatEvery || 1));
          occurrenceCount++;
        }
        break;

      case 'weekly':
      case 'biweekly':
        const weekMultiplier = pattern.patternType === 'biweekly' ? 2 : 1;
        const daysOfWeek = pattern.daysOfWeek || [baseDate.getUTCDay()];
        
        // Start from the beginning of the base week based on settings
        const weekStart = this.getWeekStart(baseDate);

        let weekCount = 0;
        while (occurrenceCount < maxOccurrences && (!endDate || weekStart <= endDate)) {
          // For each selected day of week
          daysOfWeek.forEach(dayIndex => {
            const targetDate = new Date(weekStart);
            const offset = (dayIndex - this.firstDayOfWeek + 7) % 7;
            targetDate.setUTCDate(weekStart.getUTCDate() + offset);

            // Only include if it's not before base date and within end date
            if (targetDate >= baseDate && (!endDate || targetDate <= endDate) && occurrenceCount < maxOccurrences) {
              dates.push(new Date(targetDate));
              occurrenceCount++;
            }
          });

          weekStart.setUTCDate(weekStart.getUTCDate() + (7 * weekMultiplier));
          weekCount++;
        }
        break;

      case 'monthly':
        const dayOfMonth = baseDate.getUTCDate();
        while (occurrenceCount < maxOccurrences && (!endDate || currentDate <= endDate)) {
          dates.push(new Date(currentDate));
          currentDate.setUTCMonth(currentDate.getUTCMonth() + (pattern.repeatEvery || 1));
          
          // Handle month end edge cases (e.g., Jan 31 -> Feb 28)
          if (currentDate.getUTCDate() !== dayOfMonth) {
            currentDate.setUTCDate(0); // Set to last day of previous month
          }
          occurrenceCount++;
        }
        break;
    }

    return dates;
  }

  private hasScheduleConflict(personId: number, start: Date, end: Date, ignoreScheduleId?: number): boolean {
    return !!this.findScheduleConflict(personId, start, end, ignoreScheduleId);
  }

  private findScheduleConflict(personId: number, start: Date, end: Date, ignoreScheduleId?: number): Schedule | undefined {
    // Overlap check: start < existingEnd && existingStart < end  (standard interval overlap).
    // Comparing Date objects via < / > compares their UTC millisecond values — this is
    // timezone-safe and correct regardless of the browser's local offset.  Do NOT convert
    // these Date objects with toDateString() / toLocaleDateString() before comparing.
    return this.allSchedules.find(existing => {
      if (existing.personId !== personId) return false;
      if (ignoreScheduleId && existing.scheduleId === ignoreScheduleId) return false;
      const existingStart = new Date(existing.startDate);
      const existingEnd = new Date(existing.endDate);
      return start < existingEnd && existingStart < end;
    });
  }

  /** Open the rich conflict modal with a structured ScheduleConflictInfo object. */
  showConflictModal(info: ScheduleConflictInfo): void {
    this.conflictModalInfo = info;
  }

  closeConflictModal(): void {
    this.conflictModalInfo = null;
  }

  /**
   * Build a ScheduleConflictInfo that the conflict modal renders.
   *
   * In addition to the direct-overlap entry, this method performs client-side
   * policy checks against the company settings cached by SettingsHelperService:
   *   - Minimum hours between shifts (error)
   *   - Maximum daily hours        (error)
   *   - Maximum weekly hours       (warning)
   *   - Maximum consecutive days   (warning)
   *
   * UTC NOTE: All date arithmetic uses UTC methods — never toDateString() /
   * toLocaleDateString() — to avoid off-by-one-day bugs in negative-offset
   * timezones.  See /memories/repo/utc-date-rules.md.
   */
  private buildConflictInfo(
    personId: number,
    requestedStart: Date,
    requestedEnd: Date,
    conflictingSchedule: Schedule | null | undefined,
    ignoreScheduleId?: number
  ): ScheduleConflictInfo {
    const personName = this.getPersonName(personId);
    const settings = this.activeCompany
      ? this.settingsHelper.getCachedSettings(String(this.activeCompany.companyId))
      : null;

    const violations: ConflictViolation[] = [];

    // ── 1. Overlap (error) ────────────────────────────────────────────────────
    if (conflictingSchedule) {
      const csStart = new Date(conflictingSchedule.startDate);
      const csEnd   = new Date(conflictingSchedule.endDate);
      const csLoc   = this.locations.find(l => l.locationId === conflictingSchedule.locationId)?.name
                      ?? `Location ${conflictingSchedule.locationId}`;
      violations.push({
        severity: 'error',
        rule: 'Overlapping Shift',
        detail: `Existing shift: ${this.fmtUTCShort(csStart)} – ${this.fmtUTCShort(csEnd)} at ${csLoc}`
      });
    }

    const proposedHours = (requestedEnd.getTime() - requestedStart.getTime()) / 3_600_000;

    // ── 2. Minimum rest time (error) ──────────────────────────────────────────
    if (settings?.minimumHoursBetweenShifts != null) {
      const minHours = settings.minimumHoursBetweenShifts;
      const prevShift = this.allSchedules
        .filter(s =>
          s.personId === personId &&
          (ignoreScheduleId == null || s.scheduleId !== ignoreScheduleId) &&
          (s as any).status !== 'void' &&
          new Date(s.endDate) <= requestedStart
        )
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];

      if (prevShift) {
        const gapHours = (requestedStart.getTime() - new Date(prevShift.endDate).getTime()) / 3_600_000;
        if (gapHours < minHours) {
          violations.push({
            severity: 'error',
            rule: 'Minimum Rest Time',
            detail: `Only ${gapHours.toFixed(1)}h gap before this shift ` +
                    `(min ${minHours}h required). ` +
                    `Previous shift ended at ${this.fmtUTCShort(new Date(prevShift.endDate))}.`
          });
        }
      }
    }

    // ── 3. Maximum daily hours (error) ────────────────────────────────────────
    if (settings?.maximumDailyHours != null) {
      const maxHours = settings.maximumDailyHours;
      const dayStart = new Date(Date.UTC(
        requestedStart.getUTCFullYear(), requestedStart.getUTCMonth(), requestedStart.getUTCDate()
      ));
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);

      const existingDayHours = this.allSchedules
        .filter(s =>
          s.personId === personId &&
          (ignoreScheduleId == null || s.scheduleId !== ignoreScheduleId) &&
          (s as any).status !== 'void'
        )
        .filter(s => { const t = new Date(s.startDate); return t >= dayStart && t < dayEnd; })
        .reduce((sum, s) =>
          sum + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 3_600_000, 0);

      const totalDay = existingDayHours + proposedHours;
      if (totalDay > maxHours) {
        violations.push({
          severity: 'error',
          rule: 'Maximum Daily Hours',
          detail: `Would total ${totalDay.toFixed(1)}h on ${this.fmtUTCDate(requestedStart)} ` +
                  `(company limit: ${maxHours}h/day).`
        });
      }
    }

    // ── 4. Maximum weekly hours (warning) ─────────────────────────────────────
    if (settings?.maximumWeeklyHours != null) {
      const maxWeekly = settings.maximumWeeklyHours;
      const weekStart = this.getWeekStart(requestedStart);
      const weekEnd   = new Date(weekStart.getTime() + 7 * 86_400_000);

      const existingWeekHours = this.allSchedules
        .filter(s =>
          s.personId === personId &&
          (ignoreScheduleId == null || s.scheduleId !== ignoreScheduleId) &&
          (s as any).status !== 'void'
        )
        .filter(s => { const t = new Date(s.startDate); return t >= weekStart && t < weekEnd; })
        .reduce((sum, s) =>
          sum + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 3_600_000, 0);

      const totalWeek = existingWeekHours + proposedHours;
      if (totalWeek > maxWeekly) {
        violations.push({
          severity: 'warning',
          rule: 'Maximum Weekly Hours',
          detail: `Would total ${totalWeek.toFixed(1)}h this week ` +
                  `(company limit: ${maxWeekly}h/week).`
        });
      }
    }

    // ── 5. Maximum consecutive work days (warning) ────────────────────────────
    if (settings?.maximumConsecutiveWorkDays != null) {
      const maxDays = settings.maximumConsecutiveWorkDays;
      let consecutive = 1; // Count the proposed day itself
      let checkStart = new Date(Date.UTC(
        requestedStart.getUTCFullYear(), requestedStart.getUTCMonth(), requestedStart.getUTCDate() - 1
      ));

      for (let i = 0; i < maxDays; i++) {
        const checkEnd = new Date(checkStart.getTime() + 86_400_000);
        const hasShift = this.allSchedules.some(s =>
          s.personId === personId &&
          (ignoreScheduleId == null || s.scheduleId !== ignoreScheduleId) &&
          (s as any).status !== 'void' &&
          new Date(s.startDate) >= checkStart && new Date(s.startDate) < checkEnd
        );
        if (hasShift) {
          consecutive++;
          checkStart = new Date(checkStart.getTime() - 86_400_000);
        } else {
          break;
        }
      }

      if (consecutive > maxDays) {
        violations.push({
          severity: 'warning',
          rule: 'Maximum Consecutive Work Days',
          detail: `Would be day ${consecutive} in a row ` +
                  `(company limit: ${maxDays} consecutive days).`
        });
      }
    }

    return {
      personName,
      requestedStart,
      requestedEnd,
      conflictingShift: conflictingSchedule ? {
        start: new Date(conflictingSchedule.startDate),
        end:   new Date(conflictingSchedule.endDate),
        locationName: this.locations.find(l => l.locationId === conflictingSchedule.locationId)?.name
                      ?? `Location ${conflictingSchedule.locationId}`
      } : null,
      violations
    };
  }

  /**
   * Format a Date as "13 Mar 07:00 UTC" — uses UTC getters exclusively.
   * See /memories/repo/utc-date-rules.md — Rule 6.
   */
  private fmtUTCShort(d: Date): string {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dy = String(d.getUTCDate()).padStart(2, '0');
    const mo = MONTHS[d.getUTCMonth()];
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${dy} ${mo} ${hh}:${mm} UTC`;
  }

  /** Format a Date as "13 Mar 2026" — uses UTC getters exclusively. */
  private fmtUTCDate(d: Date): string {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(d.getUTCDate()).padStart(2,'0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  private getPersonName(personId: number): string {
    return this.peopleList.find(p => p.personId === personId)?.name || `Person ${personId}`;
  }

  createDateWithTimeUTC(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(Date.UTC(
      date.getUTCFullYear(), 
      date.getUTCMonth(), 
      date.getUTCDate(), 
      hours, 
      minutes
    ));
  }
}
