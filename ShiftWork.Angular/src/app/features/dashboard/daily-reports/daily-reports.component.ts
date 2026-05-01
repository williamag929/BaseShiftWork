import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter, switchMap, takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { DailyReportService } from 'src/app/core/services/daily-report.service';
import { LocationService } from 'src/app/core/services/location.service';
import { DailyReport } from 'src/app/core/models/daily-report.model';
import { Location } from 'src/app/core/models/location.model';
import { PermissionService } from 'src/app/core/services/permission.service';

@Component({
  selector: 'app-daily-reports',
  templateUrl: './daily-reports.component.html',
  styleUrls: ['./daily-reports.component.css'],
  standalone: false
})
export class DailyReportsComponent implements OnInit, OnDestroy {
  activeCompany$: Observable<any>;
  activeCompany: any;

  locations: Location[] = [];
  selectedLocationId: number | null = null;
  selectedDate: string = this.todayStr();

  report: DailyReport | null = null;
  notes: string = '';
  loading = false;
  saving = false;
  errorMessage: string | null = null;
  accessDenied = false;

  private destroy$ = new Subject<void>();

  get canApprove(): boolean { return this.permissionService.hasPermission('reports.approve'); }

  constructor(
    private reportService: DailyReportService,
    private locationService: LocationService,
    private toastr: ToastrService,
    private store: Store<AppState>,
    private permissionService: PermissionService
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.activeCompany$.pipe(
      filter(c => !!c),
      switchMap(company => {
        this.activeCompany = company;
        return this.locationService.getLocations(company.companyId);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: locations => {
        this.locations = locations;
        if (locations.length > 0) {
          this.selectedLocationId = locations[0].locationId;
          this.loadReport();
        }
      },
      error: () => this.toastr.error('Failed to load locations')
    });
  }

  loadReport(): void {
    if (!this.selectedLocationId) return;
    this.loading = true;
    this.errorMessage = null;
    this.accessDenied = false;
    this.reportService.getReport(this.activeCompany.companyId, this.selectedLocationId, this.selectedDate).subscribe({
      next: report => {
        this.report = report;
        this.notes = report.notes ?? '';
        this.loading = false;
      },
      error: (err) => {
        if (err?.status === 403) {
          this.accessDenied = true;
        } else {
          this.errorMessage = 'Failed to load report. Check your connection and try again.';
        }
        this.loading = false;
      }
    });
  }

  retry(): void {
    this.loadReport();
  }

  onLocationChange(): void {
    this.report = null;
    this.errorMessage = null;
    this.accessDenied = false;
    this.loadReport();
  }

  onDateChange(event: any): void {
    const d: Date = event.value;
    this.selectedDate = this.formatDate(d);
    this.report = null;
    this.errorMessage = null;
    this.accessDenied = false;
    this.loadReport();
  }

  saveDraft(): void {
    if (!this.report) return;
    this.saving = true;
    this.reportService.updateReport(
      this.activeCompany.companyId,
      this.selectedLocationId!,
      this.report.reportId,
      { notes: this.notes, status: 'Draft' }
    ).subscribe({
      next: updated => {
        this.report = updated;
        this.saving = false;
        this.toastr.success('Draft saved');
      },
      error: () => {
        this.saving = false;
        this.toastr.error('Failed to save');
      }
    });
  }

  submitReport(): void {
    if (!this.report) return;
    this.saving = true;
    this.reportService.updateReport(
      this.activeCompany.companyId,
      this.selectedLocationId!,
      this.report.reportId,
      { notes: this.notes, status: 'Submitted' }
    ).subscribe({
      next: updated => {
        this.report = updated;
        this.saving = false;
        this.toastr.success('Report submitted');
      },
      error: () => {
        this.saving = false;
        this.toastr.error('Failed to submit');
      }
    });
  }

  approveReport(): void {
    if (!this.report) return;
    this.saving = true;
    this.reportService.updateReport(
      this.activeCompany.companyId,
      this.selectedLocationId!,
      this.report.reportId,
      { notes: this.notes, status: 'Approved' }
    ).subscribe({
      next: updated => {
        this.report = updated;
        this.saving = false;
        this.toastr.success('Report approved');
      },
      error: () => {
        this.saving = false;
        this.toastr.error('Failed to approve');
      }
    });
  }

  prevDay(): void {
    const d = new Date(this.selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    this.selectedDate = this.formatDate(d);
    this.report = null;
    this.loadReport();
  }

  nextDay(): void {
    const d = new Date(this.selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    this.selectedDate = this.formatDate(d);
    this.report = null;
    this.loadReport();
  }

  statusColor(status: string): string {
    switch (status) {
      case 'Approved':  return 'primary';
      case 'Submitted': return 'accent';
      default:          return '';
    }
  }

  weatherDesc(): string {
    const w = this.report?.weatherData as any;
    if (!w) return 'No data';
    return w.description ?? 'No data';
  }

  weatherTemp(): string {
    const w = this.report?.weatherData as any;
    if (!w || w.temperature == null) return '--';
    return `${Math.round(w.temperature)}°`;
  }

  weatherIcon(): string {
    const w = this.report?.weatherData as any;
    if (!w) return 'wb_sunny';
    const desc: string = (w.description ?? '').toLowerCase();
    if (desc.includes('rain') || desc.includes('drizzle')) return 'umbrella';
    if (desc.includes('cloud')) return 'cloud';
    if (desc.includes('snow')) return 'ac_unit';
    if (desc.includes('thunder') || desc.includes('storm')) return 'thunderstorm';
    if (desc.includes('fog') || desc.includes('mist')) return 'foggy';
    return 'wb_sunny';
  }

  private todayStr(): string {
    return this.formatDate(new Date());
  }

  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
