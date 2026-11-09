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
import { MatIconModule } from '@angular/material/icon';
import {
  LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzFieldComponent, LzFieldDirective, LzPageHeaderComponent,
  LzPagerComponent, LzPanelComponent, LzSegmentedComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent, paginate, type LzTone,
} from 'src/app/shared/ui';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';


@Component({
  selector: 'app-shiftsummaries',
  templateUrl: './shiftsummaries.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, CommonModule, MatIconModule, LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzFieldComponent,
    LzFieldDirective, LzPageHeaderComponent, LzPagerComponent, LzPanelComponent, LzSegmentedComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent,
  ]
})
export class ShiftsummariesComponent implements OnInit {

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
  readonly paginate = paginate;
  readonly viewOptions = [
    { value: 'cards', label: $localize`:@@shift_summaries.view_cards:Cards` },
    { value: 'table', label: $localize`:@@shift_summaries.view_table:Table` },
  ];
  page = 1;
  pageSize = 25;
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
          this.page = 1;
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

  /** Rows currently visible; Select page and the checked state apply to these only. */
  private get pageRows(): SummaryShift[] {
    return paginate(this.shiftsList || [], this.page, this.pageSize);
  }

  get allSelected(): boolean {
    const rows = this.pageRows;
    return rows.length > 0 && rows.every(s => this.isSelected(s));
  }

  get selectedCount(): number {
    return this.selectedKeys.size;
  }

  toggleSelection(s: SummaryShift, checked: boolean) {
    const key = this.selectionKey(s);
    if (checked) this.selectedKeys.add(key); else this.selectedKeys.delete(key);
  }

  toggleSelectAll(checked: boolean) {
    this.pageRows.forEach(s => (checked ? this.selectedKeys.add(this.selectionKey(s)) : this.selectedKeys.delete(this.selectionKey(s))));
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

  statusTone(status?: string): LzTone {
    switch (status) {
      case 'approved': return 'success';
      case 'avoid': return 'danger';
      case 'not_shifted': return 'neutral';
      case 'shifted':
      default: return 'info';
    }
  }

  selectLabel(s: SummaryShift): string {
    return $localize`:@@shift_summaries.select_row:Select ${s.personName}:name: ${this.formatDate(s.day)}:day:`;
  }

  statusSelectLabel(s: SummaryShift): string {
    return $localize`:@@shift_summaries.status_for_row:Status for ${s.personName}:name: ${this.formatDate(s.day)}:day:`;
  }
}
