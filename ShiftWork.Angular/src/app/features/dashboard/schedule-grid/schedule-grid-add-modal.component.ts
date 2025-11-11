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

  selectedPersonId: number | null = null;
  selectedLocationId: number = 0;
  selectedAreaId: number = 0;
  areas: Area[] = [];
  filteredAreas: Area[] = [];
  shiftType: string = 'unpublished';

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
    
    // Create proper date objects with time
    const startDate = this.createDateWithTime(this.date, this.defaultStart);
    const endDate = this.createDateWithTime(this.date, this.defaultEnd);
    
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

  createDateWithTime(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  }

  onClose() {
    this.close.emit();
  }
}
