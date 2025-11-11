import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { ScheduleService } from 'src/app/core/services/schedule.service';
import { ScheduleShiftService } from 'src/app/core/services/schedule-shift.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { LocationService } from 'src/app/core/services/location.service';
import { 
  ScheduleGridData, 
  TeamMember, 
  ShiftBlock, 
  DaySchedule, 
  ScheduleFilters 
} from 'src/app/core/models/schedule-grid.model';
import { ScheduleShift } from 'src/app/core/models/schedule-shift.model';
import { People } from 'src/app/core/models/people.model';
import { Schedule } from 'src/app/core/models/schedule.model';
import { ScheduleGridAddModalComponent } from './schedule-grid-add-modal.component';

@Component({
  selector: 'app-schedule-grid',
  standalone: true,
  imports: [CommonModule, FormsModule, ScheduleGridAddModalComponent],
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

  openAddScheduleModal() {
    this.editingSchedule = null;
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

  constructor(
    private store: Store<AppState>,
  private scheduleService: ScheduleService,
  private scheduleShiftService: ScheduleShiftService,
    private peopleService: PeopleService,
    private locationService: LocationService
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.activeCompany$.subscribe(company => {
      if (company) {
        this.activeCompany = company;
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

  initializeWeek(): void {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek;
    this.currentWeekStart = new Date(today.setDate(diff));
    this.currentWeekStart.setHours(0, 0, 0, 0);
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
        this.scheduleService.getSchedules(this.activeCompany.companyId).subscribe({
          next: (schedules: any[]) => {
            // Filter schedules to current week
            const weekShifts = schedules.filter(s => {
              const start = new Date(s.startDate);
              return start >= this.currentWeekStart && start < weekEnd;
            });
            this.buildGridData(people, weekShifts);
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
    // Build 7 days for the week
    const days: DaySchedule[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(this.currentWeekStart);
      date.setDate(date.getDate() + i);
      const dayShifts = shifts.filter(s => {
        const shiftDate = new Date(s.startDate);
        return shiftDate.toDateString() === date.toDateString();
      });
      const shiftBlocks: ShiftBlock[] = dayShifts.map(s => {
        const person = people.find(p => p.personId === s.personId);
        return {
          scheduleShiftId: s.scheduleShiftId || 0,
          personId: s.personId,
          personName: person?.name || `Person ${s.personId}`,
          startTime: this.formatTime(new Date(s.startDate)),
          endTime: this.formatTime(new Date(s.endDate)),
          startDate: new Date(s.startDate),
          endDate: new Date(s.endDate),
          locationName: undefined,
          areaName: undefined,
          status: this.mapStatus(s.status),
          isLocked: s.status.toLowerCase() === 'locked'
        };
      });
      days.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        unavailableCount: 0,
        shifts: shiftBlocks
      });
    }

    // Build team members with hours
    const teamMembers: TeamMember[] = people.map(p => {
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
    // Calculate stats
    const totalCells = days.length * teamMembers.length;
    const filledCells = shifts.length;
    const published = shifts.filter(s => s.status.toLowerCase() === 'published').length;
    const unpublished = shifts.filter(s => s.status.toLowerCase() !== 'published').length;
    const selectedLocation = this.locations.find(l => l.locationId === this.selectedLocationId);
    this.gridData = {
      weekStart: this.currentWeekStart,
      weekEnd: new Date(this.currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
      locationName: selectedLocation ? selectedLocation.name : '',
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
    const selectedLocation = this.locations.find(l => l.locationId === this.selectedLocationId);
    this.gridData.locationName = selectedLocation ? selectedLocation.name : '';
    this.loadScheduleData();
  }

  onSaveSchedule(schedule: Schedule): void {
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
    const hours = date.getHours();
    const minutes = date.getMinutes();
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
          this.showAddScheduleModalFlag = true;
        }
      },
      error: (err) => {
        console.error('Error loading schedule for edit', err);
        alert('Unable to load schedule details');
      }
    });
  }

  onAddShift(personId: number, date: Date): void {
    this.editingSchedule = null;
    this.selectedPersonId = personId;
    this.selectedDate = date;
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
}
