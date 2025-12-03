import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SummaryShift, SummaryShiftService } from 'src/app/core/services/summary-shift.service';
import { LocationService } from 'src/app/core/services/location.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { Location } from 'src/app/core/models/location.model';
import { People } from 'src/app/core/models/people.model';
import { Company } from 'src/app/core/models/company.model';
import { CommonModule } from '@angular/common';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';


@Component({
  selector: 'app-shiftsummaries',
  templateUrl: './shiftsummaries.component.html',
  styleUrls: ['./shiftsummaries.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule]
})
export class ShiftsummariesComponent implements OnInit {
  // TODO: Add option to view and check geolocation data from shift events
  // TODO: Add option to view and display photos captured during shift events (clockin/clockout)
  // TODO: Implement modal/dialog to show event details including GPS coordinates and photo URLs
  // TODO: Add visual indicators for shifts that have geolocation and/or photo data
  
  // TODO: Implement biometric photo comparison system:
  //       - Compare profile photo with shift event photos (clockin/clockout)
  //       - Display similarity percentage/confidence score for each photo match
  //       - Use machine learning to learn and improve accuracy across different shift photos
  //       - Train model with historical shift photos to detect patterns and improve verification
  //       - Flag suspicious shifts where photo similarity is below threshold
  //       - Integrate facial recognition API (e.g., AWS Rekognition, Azure Face API, or Face-api.js)
  
  // TODO: Add anomaly detection and alerts:
  //       - Detect unusual patterns: early clock-ins, late clock-outs, missing breaks
  //       - Flag shifts with GPS location outside designated work area radius
  //       - Alert on duplicate clock-ins from different locations at same time
  //       - Identify patterns of suspicious behavior (buddy punching, location spoofing)
  //       - Real-time notifications for managers when anomalies are detected
  
  // TODO: Enhance reporting and analytics:
  //       - Add charts/graphs for shift trends (overtime, attendance patterns, location distribution)
  //       - Export to Excel with formatting and multiple sheets (summary, details, anomalies)
  //       - Add PDF export with company branding and signature fields for approvals
  //       - Generate payroll-ready reports with overtime calculations and rate multipliers
  //       - Scheduled automatic report generation and email delivery
  
  // TODO: Improve filtering and search:
  //       - Add date range presets (Today, This Week, Last Week, This Month, Custom)
  //       - Multi-select for locations and areas to compare across sites
  //       - Search by employee name, ID, or external code
  //       - Save and reuse custom filter combinations
  //       - Add filters for shift status, overtime, missing breaks, photo/GPS presence
  
  // TODO: Add bulk operations enhancements:
  //       - Add comments/notes to bulk approvals with reason codes
  //       - Implement approval workflow with multi-level authorization
  //       - Track approval history and audit trail (who approved, when, why)
  //       - Add ability to reject shifts with required manager comments
  //       - Undo/revert recent approvals within time window
  
  // TODO: Add shift comparison and validation:
  //       - Compare actual shift times vs scheduled shifts to detect early/late arrivals
  //       - Calculate and display overtime automatically based on company rules
  //       - Show break compliance (required vs actual break time taken)
  //       - Highlight shifts missing clock-in or clock-out events
  //       - Add warnings for shifts exceeding maximum daily/weekly hours
  
  // TODO: Performance and UX improvements:
  //       - Implement pagination or virtual scrolling for large datasets
  //       - Add loading skeletons instead of generic spinner
  //       - Cache filter results and implement smart refresh
  //       - Add keyboard shortcuts for common actions (approve, reject, select all)
  //       - Implement drag-and-drop for bulk status changes
  //       - Add tooltips with detailed shift information on hover

  filterForm: FormGroup = this.fb.group({
    startDate: [new Date().toISOString().substring(0, 10)],
    endDate: [new Date().toISOString().substring(0, 10)],
    locationId: [null],
    personId: [null]
  });
  shifts$: Observable<SummaryShift[]> = of([]);
  locations$: Observable<Location[]> = of([]);
  people$: Observable<People[]> = of([]);
  activeCompany$: Observable<any>;
  activeCompany: any;
  loading = false;
  currentApproverPersonId?: number;

  // UI state
  viewMode: 'cards' | 'table' = 'cards';
  shiftsList: SummaryShift[] = [];
  exportApprovedOnly = true;
  bulkStatus: 'not_shifted'|'shifted'|'approved'|'avoid' = 'approved';
  private selectedKeys = new Set<string>();
  readonly statusOptions: Array<{ value: 'not_shifted'|'shifted'|'approved'|'avoid'; label: string }> = [
    { value: 'not_shifted', label: 'Not Shifted' },
    { value: 'shifted', label: 'Shifted' },
    { value: 'approved', label: 'Approved' },
    { value: 'avoid', label: 'Avoid' },
  ];

  constructor(
    private fb: FormBuilder,
    private summaryShiftService: SummaryShiftService,
    private locationService: LocationService,
    private peopleService: PeopleService,
    private authService: AuthService,
    private store: Store<AppState>
  ) {

    this.activeCompany$ = this.store.select(selectActiveCompany);

    this.activeCompany$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
        console.log('Active company set:', this.activeCompany);
      } else {
        console.log('No active company found');
      }
    });

  }

  ngOnInit(): void {
    this.activeCompany$.subscribe((company: { companyId: string }) => {
      if (company) {
        this.activeCompany = company;
        console.log('Active company set:', this.activeCompany);
        this.loading = true;
        this.activeCompany = company;
        this.locations$ = this.locationService.getLocations(company.companyId);
        this.people$ = this.peopleService.getPeople(company.companyId);
        this.getShifts();
        this.loading = false;
      }
    });

    // Capture current user personId to stamp approvals
    this.authService.user$.subscribe((p) => {
      this.currentApproverPersonId = p?.personId ?? undefined;
    });
  }


  getShifts(): void {
    if (this.filterForm.valid && this.activeCompany) {
      const { startDate, endDate, locationId, personId } = this.filterForm.value;
      this.shifts$ = this.summaryShiftService.getSummaryShifts(
        this.activeCompany.companyId,
        startDate,
        endDate,
        locationId,
        personId
      ).pipe(
        tap(list => {
          this.shiftsList = list || [];
          // prune selections no longer present
          const valid = new Set(this.shiftsList.map(s => this.selectionKey(s)));
          this.selectedKeys.forEach(k => { if (!valid.has(k)) this.selectedKeys.delete(k); });
        })
      );
    }
  }

  toggleView(mode: 'cards' | 'table') {
    this.viewMode = mode;
  }

  exportToCsv() {
    const rows = (this.shiftsList || []).filter(r => !this.exportApprovedOnly || r.status === 'approved');
    if (!rows.length) {
      return;
    }
    const header = ['Day','Person','Location','Area','Start Time','End Time','Break Time (min)','Total Hours'];
    const csvLines = [header.join(',')];
    for (const s of rows) {
      const day = this.formatDate(s.day);
      const start = this.formatTime(s.minStartTime);
      const end = this.formatTime(s.maxEndTime);
      const line = [
        this.escapeCsv(day),
        this.escapeCsv(s.personName ?? ''),
        this.escapeCsv(s.locationName ?? ''),
        this.escapeCsv(s.areaName ?? ''),
        this.escapeCsv(start),
        this.escapeCsv(end),
        String(s.breakTime ?? 0),
        String(s.totalHours ?? 0)
      ].join(',');
      csvLines.push(line);
    }
    const csvContent = '\uFEFF' + csvLines.join('\n');
    this.downloadCsv(`shift-summaries_${this.filterForm.value.startDate}_${this.filterForm.value.endDate}.csv`, csvContent);
  }

  private downloadCsv(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private formatDate(value: any): string {
    try {
      const d = new Date(value);
      return isNaN(d.getTime()) ? String(value ?? '') : d.toLocaleDateString();
    } catch { return String(value ?? ''); }
  }

  private formatTime(value: any): string {
    try {
      const d = new Date(value);
      return isNaN(d.getTime()) ? String(value ?? '') : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return String(value ?? ''); }
  }

  private escapeCsv(field: string): string {
    if (field == null) return '';
    const f = String(field);
    return /[",\n]/.test(f) ? '"' + f.replace(/"/g, '""') + '"' : f;
  }

  onStatusChange(shift: SummaryShift, status: 'not_shifted'|'shifted'|'approved'|'avoid') {
    if (!this.activeCompany) return;
    const dayIso = new Date(shift.day).toISOString();
    const payload = {
      personId: shift.personId,
      day: dayIso,
      status,
      approvedBy: this.currentApproverPersonId,
    } as const;
    this.summaryShiftService.upsertApproval(this.activeCompany.companyId, payload)
      .subscribe({
        next: _ => {
          // Update local state
          shift.status = status;
        },
        error: err => console.error('Failed to update approval', err)
      });
  }

  // Selection helpers
  private selectionKey(s: SummaryShift): string {
    const d = new Date(s.day);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${s.personId}-${yyyy}-${mm}-${dd}`;
  }

  isSelected(s: SummaryShift): boolean {
    return this.selectedKeys.has(this.selectionKey(s));
  }

  get allSelected(): boolean {
    const rows = this.shiftsList || [];
    return rows.length > 0 && rows.every(s => this.isSelected(s));
  }

  toggleSelection(s: SummaryShift, checked: boolean) {
    const key = this.selectionKey(s);
    if (checked) this.selectedKeys.add(key); else this.selectedKeys.delete(key);
  }

  toggleSelectAll(checked: boolean) {
    if (checked) {
      (this.shiftsList || []).forEach(s => this.selectedKeys.add(this.selectionKey(s)));
    } else {
      this.selectedKeys.clear();
    }
  }

  applyBulk() {
    if (!this.activeCompany) return;
    const status = this.bulkStatus;
    const map = new Map(this.shiftsList.map(s => [this.selectionKey(s), s] as const));
    const keys = Array.from(this.selectedKeys);
    keys.forEach(k => {
      const s = map.get(k);
      if (s) this.onStatusChange(s, status);
    });
  }

  statusLabel(status?: string): string {
    switch (status) {
      case 'approved': return 'Approved';
      case 'avoid': return 'Avoid';
      case 'not_shifted': return 'Not Shifted';
      case 'shifted':
      default: return 'Shifted';
    }
  }

  statusClass(status?: string): string {
    switch (status) {
      case 'approved': return 'status-badge status-approved';
      case 'avoid': return 'status-badge status-avoid';
      case 'not_shifted': return 'status-badge status-not-shifted';
      case 'shifted':
      default: return 'status-badge status-shifted';
    }
  }
}
