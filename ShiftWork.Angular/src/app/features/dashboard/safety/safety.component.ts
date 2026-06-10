import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { filter, switchMap, takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { SafetyService } from 'src/app/core/services/safety.service';
import { SafetyContent, AcknowledgmentStatus, CreateSafetyContentDto } from 'src/app/core/models/safety.model';
import { PagedResult } from 'src/app/core/models/paged-result.model';
import { LocationService } from 'src/app/core/services/location.service';
import { Location } from 'src/app/core/models/location.model';
import { PermissionService } from 'src/app/core/services/permission.service';

@Component({
  selector: 'app-safety',
  templateUrl: './safety.component.html',
  styleUrls: ['./safety.component.css'],
  standalone: false
})
export class SafetyComponent implements OnInit, OnDestroy {
  activeCompany$: Observable<any>;
  activeCompany: any;

  contents: SafetyContent[] = [];
  pending: SafetyContent[] = [];
  locations: Location[] = [];
  activeTab: 'all' | 'pending' = 'all';
  loading = false;
  errorMessage: string | null = null;
  showForm = false;

  totalCount = 0;
  page = 1;
  pageSize = 25;

  complianceMap = new Map<string, AcknowledgmentStatus>();
  expandedId: string | null = null;

  form!: FormGroup;

  readonly types = ['ToolboxTalk', 'SafetyDataSheet', 'Orientation', 'InstructionalVideo', 'Training'];
  readonly statuses = ['Draft', 'Published'];

  private destroy$ = new Subject<void>();

  get canCreate(): boolean { return this.permissionService.hasPermission('safety.create'); }
  get canArchive(): boolean { return this.permissionService.hasPermission('safety.delete'); }

  constructor(
    private safetyService: SafetyService,
    private locationService: LocationService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private store: Store<AppState>,
    private permissionService: PermissionService
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      type: ['ToolboxTalk', Validators.required],
      textContent: [''],
      isAcknowledgmentRequired: [true],
      locationId: [null],
      scheduledFor: [null],
      status: ['Published', Validators.required]
    });

    this.activeCompany$.pipe(
      filter(c => !!c),
      switchMap(company => {
        this.activeCompany = company;
        this.loadLocations();
        return this.load();
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  loadLocations(): void {
    this.locationService.getLocations(this.activeCompany.companyId).subscribe({
      next: locations => {
        this.locations = locations.filter(l => l.status?.toLowerCase() !== 'inactive');
      },
      error: () => {
        this.locations = [];
      }
    });
  }

  load(): Observable<PagedResult<SafetyContent>> {
    this.loading = true;
    this.errorMessage = null;
    const obs = this.safetyService.getContents(
      this.activeCompany.companyId,
      undefined, undefined, undefined,
      this.page, this.pageSize
    );
    obs.subscribe({
      next: result => {
        this.contents = result.items;
        this.totalCount = result.totalCount;
        this.pending = result.items.filter(c => c.isAcknowledgmentRequired && !c.isAcknowledgedByCurrentUser && c.status === 'Published');
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load safety content. Check your connection and try again.';
        this.loading = false;
      }
    });
    return obs;
  }

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.load();
  }

  retry(): void {
    this.load();
  }

  acknowledge(content: SafetyContent): void {
    this.safetyService.acknowledge(this.activeCompany.companyId, content.safetyContentId).subscribe({
      next: () => {
        content.isAcknowledgedByCurrentUser = true;
        this.pending = this.pending.filter(p => p.safetyContentId !== content.safetyContentId);
        this.toastr.success('Acknowledged');
      },
      error: () => this.toastr.error('Failed to acknowledge')
    });
  }

  toggleCompliance(content: SafetyContent): void {
    if (this.expandedId === content.safetyContentId) {
      this.expandedId = null;
      return;
    }
    this.expandedId = content.safetyContentId;
    if (!this.complianceMap.has(content.safetyContentId)) {
      this.safetyService.getAcknowledgmentStatus(this.activeCompany.companyId, content.safetyContentId).subscribe({
        next: status => this.complianceMap.set(content.safetyContentId, status),
        error: () => this.toastr.error('Failed to load compliance data')
      });
    }
  }

  submit(): void {
    if (this.form.invalid) return;
    const dto: CreateSafetyContentDto = this.form.value;
    this.safetyService.createContent(this.activeCompany.companyId, dto).subscribe({
      next: created => {
        this.contents.unshift(created);
        if (created.isAcknowledgmentRequired && !created.isAcknowledgedByCurrentUser)
          this.pending.unshift(created);
        this.form.reset({ type: 'ToolboxTalk', isAcknowledgmentRequired: true, status: 'Published' });
        this.showForm = false;
        this.toastr.success('Safety content published');
      },
      error: () => this.toastr.error('Failed to create safety content')
    });
  }

  archive(content: SafetyContent, event: Event): void {
    event.stopPropagation();
    this.safetyService.archiveContent(this.activeCompany.companyId, content.safetyContentId).subscribe({
      next: () => {
        this.contents = this.contents.filter(c => c.safetyContentId !== content.safetyContentId);
        this.pending = this.pending.filter(c => c.safetyContentId !== content.safetyContentId);
        this.toastr.success('Archived');
      },
      error: () => this.toastr.error('Failed to archive')
    });
  }

  pendingCount(): number {
    return this.pending.length;
  }

  compliance(id: string): AcknowledgmentStatus | null {
    return this.complianceMap.get(id) ?? null;
  }

  completionPct(status: AcknowledgmentStatus): number {
    return Math.round(status.completionRate * 100);
  }

  locationName(locationId?: number): string {
    if (!locationId) return 'All locations';
    return this.locations.find(l => l.locationId === locationId)?.name ?? `Location #${locationId}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
