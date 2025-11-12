import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { People } from 'src/app/core/models/people.model';
import { Schedule } from 'src/app/core/models/schedule.model';
import { Location } from 'src/app/core/models/location.model';
import { Area } from 'src/app/core/models/area.model';
import { AreaService } from 'src/app/core/services/area.service';

@Component({
  selector: 'app-schedule-grid-add-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule-grid-add-modal.component.html',
  styleUrls: ['./schedule-grid-add-modal.component.css']
})
export class ScheduleGridAddModalComponent implements OnInit {
  @Input() people: People[] = [];
  @Input() date: Date = new Date();
  @Input() locations: Location[] = [];
  @Input() locationId: number = 0;
  @Input() personId: number | null = null;
  @Input() companyId: string = '';
  @Input() existingSchedule: Schedule | null = null;
  @Input() defaultStart: string = '07:00';
  @Input() defaultEnd: string = '15:00';
  @Output() save = new EventEmitter<Schedule>();
  @Output() close = new EventEmitter<void>();
  @Output() delete = new EventEmitter<number>();
  @Output() viewProfileRequest = new EventEmitter<number>();
  @Output() repeatTomorrowRequest = new EventEmitter<{ baseDate: Date; personId: number|null; locationId: number; areaId: number; start: string; end: string }>();
  @Output() repeatRestOfWeekRequest = new EventEmitter<{ baseDate: Date; personId: number|null; locationId: number; areaId: number; start: string; end: string }>();
  @Output() repeatSpecificDaysRequest = new EventEmitter<{ baseDate: Date; personId: number|null; locationId: number; areaId: number; start: string; end: string; dayIndices: number[] }>();
  @Output() requestTimeOffRequest = new EventEmitter<{ personId: number|null; start: Date; end: Date; note?: string }>();
  @Output() reportSickRequest = new EventEmitter<{ personId: number|null; date: Date; note?: string }>();
  @Output() findReplacementRequest = new EventEmitter<{ personId: number|null; start: Date; end: Date; locationId: number; areaId: number }>();
  // Future: repeatSpecificDaysRequest, repeatSetPatternRequest
  @Input() deleteInProgress: boolean = false;

  selectedPersonId: number | null = null;
  selectedLocationId: number = 0;
  selectedAreaId: number = 0;
  areas: Area[] = [];
  filteredAreas: Area[] = [];
  shiftType: string = 'unpublished';
  // menu state
  menuOpen: boolean = false;
  specificDaysMode: boolean = false;
  selectedDayIndices: Set<number> = new Set();

  constructor(private areaService: AreaService) {}

  ngOnInit() {
    // If editing existing schedule, populate fields
    if (this.existingSchedule) {
      this.selectedPersonId = this.existingSchedule.personId;
      this.selectedLocationId = this.existingSchedule.locationId;
      this.selectedAreaId = this.existingSchedule.areaId;
      
      const startDate = new Date(this.existingSchedule.startDate);
      const endDate = new Date(this.existingSchedule.endDate);
      this.defaultStart = this.formatTimeForInput(startDate);
      this.defaultEnd = this.formatTimeForInput(endDate);
    } else {
      if (this.personId) {
        this.selectedPersonId = this.personId;
      }
      if (this.locationId) {
        this.selectedLocationId = this.locationId;
      }
    }
    this.loadAreas();
  }

  formatTimeForInput(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  loadAreas() {
    console.log('Loading areas for companyId:', this.companyId);

    if (this.companyId) {
      this.areaService.getAreas(this.companyId).subscribe({
        next: (areas) => {
          this.areas = areas;
          console.log('Loaded areas:', this.areas);
          this.filterAreasByLocation();
        },
        error: (err) => {
          console.error('Error loading areas', err);
        }
      });
    }
  }

  onLocationChange() {
    this.filterAreasByLocation();
  }

  filterAreasByLocation() {
    console.log('Filtering areas for locationId:', this.selectedLocationId);
    if (this.selectedLocationId) {
      const locId = Number(this.selectedLocationId);
      this.filteredAreas = this.areas.filter(a => {
        const areaLocId = a && (a as any).locationId !== undefined && (a as any).locationId !== null
          ? Number((a as any).locationId)
          : NaN;
        return !Number.isNaN(areaLocId) && areaLocId === locId;
      });
      if (this.filteredAreas.length > 0) {
        this.selectedAreaId = this.filteredAreas[0].areaId;
      } else {
        this.selectedAreaId = 0;
      }
    } else {
      this.filteredAreas = [];
      this.selectedAreaId = 0;
    }
  }

  onSave() {
    const selectedLocation = this.locations.find(l => l.locationId === this.selectedLocationId);
    
    // Create proper date objects with time using UTC to avoid timezone issues
    const startDate = this.createDateWithTimeUTC(this.date, this.defaultStart);
    const endDate = this.createDateWithTimeUTC(this.date, this.defaultEnd);
    
    const schedule: Schedule = {
      scheduleId: this.existingSchedule?.scheduleId || 0,
      name: this.existingSchedule?.name || `Schedule for ${this.date.toDateString()}`,
      companyId: this.companyId,
      personId: this.selectedPersonId ?? 0,
      startDate: startDate,
      endDate: endDate,
      locationId: this.selectedLocationId,
      areaId: this.selectedAreaId,
      status: this.existingSchedule?.status || (this.shiftType === 'empty' || this.selectedPersonId ? 'unpublished' : this.shiftType),
      timezone: selectedLocation?.timezone || 'UTC',
      crewId: this.existingSchedule?.crewId,
      taskShiftId: this.existingSchedule?.taskShiftId,
      description: this.existingSchedule?.description,
      settings: this.existingSchedule?.settings,
      color: this.existingSchedule?.color,
      externalCode: this.existingSchedule?.externalCode,
      type: this.existingSchedule?.type,
    };
    this.save.emit(schedule);
  }

  // --- Footer More menu logic ---
  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) {
      // close menu when clicking outside
      setTimeout(() => {
        const onDocClick = () => {
          this.menuOpen = false;
          document.removeEventListener('click', onDocClick);
        };
        document.addEventListener('click', onDocClick);
      });
    }
  }

  get personName(): string {
    const pid = this.selectedPersonId ?? this.personId ?? this.existingSchedule?.personId ?? null;
    const person = this.people?.find(p => p.personId === pid);
    return person?.name || 'employee';
  }

  repeatTomorrow(): void {
    this.menuOpen = false;
    this.repeatTomorrowRequest.emit({
      baseDate: this.date,
      personId: this.selectedPersonId ?? this.personId,
      locationId: this.selectedLocationId,
      areaId: this.selectedAreaId,
      start: this.defaultStart,
      end: this.defaultEnd
    });
  }
  repeatRestOfWeek(): void {
    this.menuOpen = false;
    this.repeatRestOfWeekRequest.emit({
      baseDate: this.date,
      personId: this.selectedPersonId ?? this.personId,
      locationId: this.selectedLocationId,
      areaId: this.selectedAreaId,
      start: this.defaultStart,
      end: this.defaultEnd
    });
  }
  repeatSpecificDays(): void {
    // Enter day selection mode inside the menu instead of emitting immediately
    this.specificDaysMode = true;
    // Pre-select current date's weekday
    const wd = this.date.getDay();
    this.selectedDayIndices = new Set([wd]);
  }
  repeatSetPattern(): void {
    console.log('Repeat for set pattern clicked');
    this.menuOpen = false;
  }

  requestTimeOff(): void {
    this.menuOpen = false;
    const personId = this.selectedPersonId ?? this.personId ?? null;
    if (!personId) { alert('Select a person first'); return; }
    const start = this.createDateWithTimeUTC(this.date, this.defaultStart);
    const end = this.createDateWithTimeUTC(this.date, this.defaultEnd);
    this.requestTimeOffRequest.emit({ personId, start, end });
  }

  reportSick(): void {
    this.menuOpen = false;
    const personId = this.selectedPersonId ?? this.personId ?? null;
    if (!personId) { alert('Select a person first'); return; }
    this.reportSickRequest.emit({ personId, date: this.date });
  }

  findReplacement(): void {
    this.menuOpen = false;
    const personId = this.selectedPersonId ?? this.personId ?? null;
    if (!personId) { alert('Select a person first'); return; }
    const start = this.createDateWithTimeUTC(this.date, this.defaultStart);
    const end = this.createDateWithTimeUTC(this.date, this.defaultEnd);
    this.findReplacementRequest.emit({ personId, start, end, locationId: this.selectedLocationId, areaId: this.selectedAreaId });
  }

  toggleDayIndex(idx: number): void {
    if (this.selectedDayIndices.has(idx)) {
      this.selectedDayIndices.delete(idx);
    } else {
      this.selectedDayIndices.add(idx);
    }
  }

  cancelSpecificDays(): void {
    this.specificDaysMode = false;
    this.selectedDayIndices.clear();
  }

  confirmSpecificDays(): void {
    if (this.selectedDayIndices.size === 0) {
      alert('Select at least one day.');
      return;
    }
    this.menuOpen = false;
    this.specificDaysMode = false;
    this.repeatSpecificDaysRequest.emit({
      baseDate: this.date,
      personId: this.selectedPersonId ?? this.personId,
      locationId: this.selectedLocationId,
      areaId: this.selectedAreaId,
      start: this.defaultStart,
      end: this.defaultEnd,
      dayIndices: Array.from(this.selectedDayIndices.values()).sort()
    });
    this.selectedDayIndices.clear();
  }
  viewProfile(): void {
    this.menuOpen = false;
    const pid = this.selectedPersonId ?? this.personId ?? this.existingSchedule?.personId;
    if (pid) {
      this.viewProfileRequest.emit(pid);
    } else {
      console.warn('No person selected for profile view');
    }
  }
  viewShiftHistory(): void {
    console.log('View shift history clicked');
    this.menuOpen = false;
  }
  deleteShiftClicked(): void {
    this.menuOpen = false;
    if (this.existingSchedule?.scheduleId) {
      this.delete.emit(this.existingSchedule.scheduleId);
    } else {
      console.warn('No existing schedule to delete');
    }
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

  onClose() {
    this.close.emit();
  }
}
