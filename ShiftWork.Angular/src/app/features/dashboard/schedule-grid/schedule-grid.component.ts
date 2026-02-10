import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { Observable } from 'rxjs';
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
  ViewMode
} from 'src/app/core/models/schedule-grid.model';
import { ScheduleShift } from 'src/app/core/models/schedule-shift.model';
import { People } from 'src/app/core/models/people.model';
import { Schedule } from 'src/app/core/models/schedule.model';
import { ScheduleGridAddModalComponent } from './schedule-grid-add-modal.component';
import { ReplacementPanelComponent } from './replacement-panel.component';
import { TimeOffRequestModalComponent } from './time-off-request-modal.component';
import { SickReportModalComponent, SickReportRequest } from './sick-report-modal.component';
import { RepeatPatternModalComponent, RepeatPatternRequest } from './repeat-pattern-modal.component';
import { ShiftHistoryModalComponent } from './shift-history-modal.component';

@Component({
  selector: 'app-schedule-grid',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, ScheduleGridAddModalComponent, ReplacementPanelComponent, TimeOffRequestModalComponent, SickReportModalComponent, RepeatPatternModalComponent, ShiftHistoryModalComponent],
  templateUrl: './schedule-grid.component.html',
  styleUrl: './schedule-grid.component.css',
  providers: [ScheduleService, PeopleService, LocationService]
})
export class ScheduleGridComponent implements OnInit {
  showAddScheduleModalFlag: boolean = false;
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
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startDate = this.buildDateWithTime(tomorrow, payload.start);
    const endDate = this.buildDateWithTime(tomorrow, payload.end);
    if (this.hasScheduleConflict(payload.personId, startDate, endDate)) {
      alert(`Schedule conflict for ${this.getPersonName(payload.personId)} on ${tomorrow.toDateString()}.`);
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
    weekEnd.setDate(weekStart.getDate() + 7);
    const promises: Promise<any>[] = [];
    const current = new Date(base);
    current.setDate(current.getDate() + 1);
    while (current < weekEnd) {
      const d = new Date(current);
      const startDate = this.buildDateWithTime(d, payload.start);
      const endDate = this.buildDateWithTime(d, payload.end);
      if (this.hasScheduleConflict(payload.personId, startDate, endDate)) {
        alert(`Schedule conflict for ${this.getPersonName(payload.personId)} on ${d.toDateString()}.`);
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
      current.setDate(current.getDate() + 1);
    }
    Promise.all(promises).then(() => this.loadScheduleData()).catch(err => console.error('Repeat rest of week failed', err));
  }

  private buildDateWithTime(date: Date, time: string): Date {
    const [h,m] = time.split(':').map(Number);
    return new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
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
    if (this.hasScheduleConflict(personId, ctx.start, ctx.end)) {
      alert(`Schedule conflict for ${this.getPersonName(personId)} on ${ctx.start.toDateString()}.`);
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
      d.setDate(startOfWeek.getDate() + offset);
      const startDate = this.buildDateWithTime(d, payload.start);
      const endDate = this.buildDateWithTime(d, payload.end);
      if (this.hasScheduleConflict(payload.personId!, startDate, endDate)) {
        alert(`Schedule conflict for ${this.getPersonName(payload.personId!)} on ${d.toDateString()}.`);
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
    this.editingSchedule = null;
    // If modalLocationId hasn't been set by onAddShift/onAddEmployeeToLocation, resolve it
    if (!this.modalLocationId && this.selectedLocationId && this.selectedLocationId > 0) {
      this.modalLocationId = this.selectedLocationId;
    }
    this.showAddScheduleModalFlag = true;
  }
  closeAddScheduleModal() {
    this.showAddScheduleModalFlag = false;
    this.selectedPersonId = null;
    this.selectedDate = null;
    this.editingSchedule = null;
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
              targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(),
              originalStartDate.getUTCHours(), originalStartDate.getUTCMinutes(), 0
            ));
            const newEndDate = new Date(Date.UTC(
              targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(),
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
  selectedLocationId: number | null = null;
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
  firstDayOfWeek: 0 | 1 = 0;
  allSchedules: Schedule[] = [];
  viewMode: ViewMode = 'single';
  locationGroups: LocationGroup[] = [];
  modalLocationId: number = 0;
  allDropListIds: string[] = [];
  dragInProgress: boolean = false;

  constructor(
    private store: Store<AppState>,
    private scheduleService: ScheduleService,
    private scheduleShiftService: ScheduleShiftService,
    private peopleService: PeopleService,
    private locationService: LocationService,
    private shiftEventService: ShiftEventService,
    private timeOffRequestService: TimeOffRequestService,
    private replacementRequestService: ReplacementRequestService,
    private settingsHelper: SettingsHelperService,
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
              this.loadScheduleData();
            });
          }
        });
      }
    });
  }

  initializeWeek(): void {
    const today = new Date();
    this.currentWeekStart = this.getWeekStart(today);
  }

  private getWeekStart(date: Date): Date {
    const start = new Date(date);
    const dayOfWeek = start.getDay();
    const diff = (dayOfWeek - this.firstDayOfWeek + 7) % 7;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  loadScheduleData(): void {
    if (!this.activeCompany?.companyId) return;

    this.loading = true;
    this.error = null;

    const weekEnd = new Date(this.currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    this.peopleService.getPeople(this.activeCompany.companyId).subscribe({
      next: (people: People[]) => {
        this.peopleList = people;
        this.scheduleService.getSchedulesPaged(
          this.activeCompany.companyId,
          this.currentWeekStart.toISOString(),
          weekEnd.toISOString(),
          1,
          500
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

    if (this.viewMode === 'single' && this.selectedLocationId && this.selectedLocationId > 0) {
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
      weekEnd: new Date(this.currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
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

  /** Build DaySchedule[] for 7 days of the week from the given shifts */
  private buildDays(shifts: ScheduleShift[], people: People[]): DaySchedule[] {
    const days: DaySchedule[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(this.currentWeekStart);
      date.setDate(date.getDate() + i);
      const dayShifts = shifts.filter(s => {
        const shiftDate = new Date(s.startDate);
        // Compare using UTC date components to avoid timezone-shifted day mismatches
        return shiftDate.getUTCFullYear() === date.getFullYear()
          && shiftDate.getUTCMonth() === date.getMonth()
          && shiftDate.getUTCDate() === date.getDate();
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
          isOnShiftNow: isOnShift && isWithinWindow,
          isCompleted
        };
      });
      days.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
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

  /** Get shifts for a person on a given day within a specific location group */
  getShiftsForPersonDayAndLocation(personId: number, date: Date, locationId: number): ShiftBlock[] {
    const group = this.locationGroups.find(g => g.locationId === locationId);
    if (!group) return [];
    const day = group.days.find(d => d.date.toDateString() === date.toDateString());
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
    } else if (this.viewMode === 'single' && this.selectedLocationId && this.selectedLocationId > 0) {
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
          for (let i = 0; i < 7; i++) {
            ids.push(this.getCellDropId(member.personId, i, group.locationId));
          }
        });
      });
    } else {
      this.gridData.teamMembers.forEach(member => {
        for (let i = 0; i < 7; i++) {
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
      targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(),
      origStart.getUTCHours(), origStart.getUTCMinutes(), 0
    ));
    const newEndDate = new Date(Date.UTC(
      targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(),
      origEnd.getUTCHours(), origEnd.getUTCMinutes(), 0
    ));

    if (this.hasScheduleConflict(original.personId, newStartDate, newEndDate, original.scheduleId)) {
      alert(`Schedule conflict for ${this.getPersonName(original.personId)} on ${targetDate.toDateString()}.`);
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

  onSaveSchedule(schedule: Schedule): void {
    if (schedule.personId) {
      const ignoreId = this.editingSchedule?.scheduleId;
      if (this.hasScheduleConflict(schedule.personId, new Date(schedule.startDate), new Date(schedule.endDate), ignoreId)) {
        alert(`Schedule conflict for ${this.getPersonName(schedule.personId)} on ${new Date(schedule.startDate).toDateString()}.`);
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

  mapStatus(status: string): 'published' | 'unpublished' | 'locked' | 'open' {
    const s = status.toLowerCase();
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
    const day = this.gridData.days.find(d => 
      d.date.toDateString() === date.toDateString()
    );
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
    } else if (this.viewMode === 'single' && this.selectedLocationId && this.selectedLocationId > 0) {
      this.modalLocationId = this.selectedLocationId;
    } else {
      this.modalLocationId = 0;
    }
    this.openAddScheduleModal();
  }

  onPreviousWeek(): void {
    const newDate = new Date(this.currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    this.currentWeekStart = newDate;
    this.loadScheduleData();
  }

  onNextWeek(): void {
    const newDate = new Date(this.currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
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

    // Get all schedules for the current week
    this.scheduleService.getSchedules(this.activeCompany.companyId).subscribe({
      next: (schedules: any[]) => {
        // Filter unpublished schedules within current week
        const weekStart = new Date(this.currentWeekStart);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const unpublishedSchedules = schedules.filter(s => {
          const scheduleDate = new Date(s.startDate);
          return s.status === 'unpublished' && 
                 scheduleDate >= weekStart && 
                 scheduleDate < weekEnd;
        });

        if (unpublishedSchedules.length === 0) {
          this.loading = false;
          alert('No unpublished schedules found for this week.');
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
      if (this.hasScheduleConflict(request.personId, startDate, endDate)) {
        alert(`Schedule conflict for ${this.getPersonName(request.personId)} on ${date.toDateString()}.`);
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
    baseDate.setHours(0, 0, 0, 0);

    // Determine end condition
    let endDate: Date | null = null;
    let maxOccurrences = pattern.occurrences || 52; // Default to 52 if not specified

    if (pattern.endDate) {
      endDate = new Date(pattern.endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    let currentDate = new Date(baseDate);
    let occurrenceCount = 0;

    switch (pattern.patternType) {
      case 'daily':
        while (occurrenceCount < maxOccurrences && (!endDate || currentDate <= endDate)) {
          dates.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + (pattern.repeatEvery || 1));
          occurrenceCount++;
        }
        break;

      case 'weekly':
      case 'biweekly':
        const weekMultiplier = pattern.patternType === 'biweekly' ? 2 : 1;
        const daysOfWeek = pattern.daysOfWeek || [baseDate.getDay()];
        
        // Start from the beginning of the base week based on settings
        const weekStart = this.getWeekStart(baseDate);

        let weekCount = 0;
        while (occurrenceCount < maxOccurrences && (!endDate || weekStart <= endDate)) {
          // For each selected day of week
          daysOfWeek.forEach(dayIndex => {
            const targetDate = new Date(weekStart);
            const offset = (dayIndex - this.firstDayOfWeek + 7) % 7;
            targetDate.setDate(weekStart.getDate() + offset);

            // Only include if it's not before base date and within end date
            if (targetDate >= baseDate && (!endDate || targetDate <= endDate) && occurrenceCount < maxOccurrences) {
              dates.push(new Date(targetDate));
              occurrenceCount++;
            }
          });

          weekStart.setDate(weekStart.getDate() + (7 * weekMultiplier));
          weekCount++;
        }
        break;

      case 'monthly':
        const dayOfMonth = baseDate.getDate();
        while (occurrenceCount < maxOccurrences && (!endDate || currentDate <= endDate)) {
          dates.push(new Date(currentDate));
          currentDate.setMonth(currentDate.getMonth() + (pattern.repeatEvery || 1));
          
          // Handle month end edge cases (e.g., Jan 31 -> Feb 28)
          if (currentDate.getDate() !== dayOfMonth) {
            currentDate.setDate(0); // Set to last day of previous month
          }
          occurrenceCount++;
        }
        break;
    }

    return dates;
  }

  private hasScheduleConflict(personId: number, start: Date, end: Date, ignoreScheduleId?: number): boolean {
    return this.allSchedules.some(existing => {
      if (existing.personId !== personId) return false;
      if (ignoreScheduleId && existing.scheduleId === ignoreScheduleId) return false;
      const existingStart = new Date(existing.startDate);
      const existingEnd = new Date(existing.endDate);
      return start < existingEnd && existingStart < end;
    });
  }

  private getPersonName(personId: number): string {
    return this.peopleList.find(p => p.personId === personId)?.name || `Person ${personId}`;
  }

  createDateWithTimeUTC(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(Date.UTC(
      date.getFullYear(), 
      date.getMonth(), 
      date.getDate(), 
      hours, 
      minutes
    ));
  }
}
