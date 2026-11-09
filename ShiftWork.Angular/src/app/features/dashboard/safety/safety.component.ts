import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { SafetyService } from 'src/app/core/services/safety.service';
import { SafetyContent, AcknowledgmentStatus, CreateSafetyContentDto } from 'src/app/core/models/safety.model';
import { LocationService } from 'src/app/core/services/location.service';
import { Location } from 'src/app/core/models/location.model';
import { PermissionService } from 'src/app/core/services/permission.service';

@Component({
  selector: 'app-safety',
  templateUrl: './safety.component.html',
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
  panelOpen = false;
  saving = false;
  openerEl: HTMLElement | null = null;
  contentToArchive: SafetyContent | null = null;
  private archiveOpener: HTMLElement | null = null;
  private tabOptionsCache: { pending: number; options: { value: string; label: string }[] } | null = null;
  @ViewChild('addBtn') private addBtn?: ElementRef<HTMLElement>;
  @ViewChild('listRegion') private listRegion?: ElementRef<HTMLElement>;

  totalCount = 0;
  page = 1;
  pageSize = 25;

  complianceMap = new Map<string, AcknowledgmentStatus>();
  expandedId: string | null = null;
  complianceFailed = new Set<string>();

  form!: FormGroup;

  readonly types = ['ToolboxTalk', 'SafetyDataSheet', 'Orientation', 'InstructionalVideo', 'Training'];
  readonly statuses = ['Draft', 'Published'];

  readonly typeLabels: Record<string, string> = {
    ToolboxTalk: $localize`:@@safety.type_toolbox_talk:Toolbox talk`,
    SafetyDataSheet: $localize`:@@safety.type_sds:Safety data sheet`,
    Orientation: $localize`:@@safety.type_orientation:Orientation`,
    InstructionalVideo: $localize`:@@safety.type_video:Instructional video`,
    Training: $localize`:@@safety.type_training:Training`
  };
  readonly statusLabels: Record<string, string> = {
    Draft: $localize`:@@safety.status_draft:Draft`,
    Published: $localize`:@@safety.status_published:Published`
  };
  readonly addLabel = $localize`:@@safety.form_heading:New safety content`;
  readonly titleRequired = $localize`:@@safety.title_error:Title is required`;
  readonly descriptionRequired = $localize`:@@safety.description_error:Description is required`;

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
      scheduledFor: [''],
      status: ['Published', Validators.required]
    });

    this.activeCompany$.pipe(
      filter(c => !!c),
      takeUntil(this.destroy$)
    ).subscribe(company => {
      this.activeCompany = company;
      this.loadLocations();
      this.load();
    });
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

  load(): void {
    this.loading = true;
    this.errorMessage = null;
    this.safetyService.getContents(
      this.activeCompany.companyId,
      undefined, undefined, undefined,
      this.page, this.pageSize
    ).subscribe({
      next: result => {
        this.totalCount = result.totalCount;
        const lastPage = Math.max(1, Math.ceil(result.totalCount / this.pageSize));
        if (this.page > lastPage) {
          this.page = lastPage;
          this.load();
          return;
        }
        this.contents = result.items;
        this.pending = result.items.filter(c => c.isAcknowledgmentRequired && !c.isAcknowledgedByCurrentUser && c.status === 'Published');
        this.loading = false;
      },
      error: () => {
        this.errorMessage = $localize`:@@safety.load_error:Could not load safety content. Check your connection and try again.`;
        this.loading = false;
      }
    });
  }

  onPageChange(page: number): void {
    this.page = page;
    this.load();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.load();
  }

  get visibleContents(): SafetyContent[] {
    return this.activeTab === 'all' ? this.contents : this.pending;
  }

  setTab(tab: string): void {
    this.activeTab = tab as 'all' | 'pending';
  }

  get tabOptions(): { value: string; label: string }[] {
    const pending = this.pendingCount();
    if (this.tabOptionsCache?.pending !== pending) {
      this.tabOptionsCache = {
        pending,
        options: [
          { value: 'all', label: $localize`:@@safety.tab_all:All content` },
          { value: 'pending', label: pending > 0 ? $localize`:@@safety.tab_pending_count:Pending acknowledgment (${pending}:count:)` : $localize`:@@safety.tab_pending:Pending acknowledgment` }
        ]
      };
    }
    return this.tabOptionsCache.options;
  }

  retry(): void {
    this.load();
  }

  acknowledge(content: SafetyContent): void {
    this.safetyService.acknowledge(this.activeCompany.companyId, content.safetyContentId).subscribe({
      next: () => {
        content.isAcknowledgedByCurrentUser = true;
        this.pending = this.pending.filter(p => p.safetyContentId !== content.safetyContentId);
        this.toastr.success($localize`:@@safety.toast_acknowledged:Acknowledged.`);
      },
      error: () => this.toastr.error($localize`:@@safety.toast_ack_failed:Could not save your acknowledgment.`)
    });
  }

  toggleCompliance(content: SafetyContent): void {
    if (this.expandedId === content.safetyContentId) {
      this.expandedId = null;
      return;
    }
    this.expandedId = content.safetyContentId;
    if (!this.complianceMap.has(content.safetyContentId)) {
      this.complianceFailed.delete(content.safetyContentId);
      this.safetyService.getAcknowledgmentStatus(this.activeCompany.companyId, content.safetyContentId).subscribe({
        next: status => this.complianceMap.set(content.safetyContentId, status),
        error: () => {
          this.complianceFailed.add(content.safetyContentId);
          this.toastr.error($localize`:@@safety.toast_compliance_failed:Could not load compliance data.`);
        }
      });
    }
  }

  openNew(): void {
    this.cancelForm();
    this.panelOpen = true;
  }

  cancelForm(): void {
    this.panelOpen = false;
    this.form.reset({ type: 'ToolboxTalk', isAcknowledgmentRequired: true, status: 'Published' });
  }

  submit(): void {
    if (this.form.invalid || this.saving) return;
    const raw = this.form.value;
    const dto: CreateSafetyContentDto = {
      ...raw,
      scheduledFor: raw.scheduledFor ? new Date(`${raw.scheduledFor}T00:00:00`).toISOString() : null
    };
    this.saving = true;
    this.safetyService.createContent(this.activeCompany.companyId, dto).subscribe({
      next: created => {
        this.saving = false;
        this.contents.unshift(created);
        this.totalCount++;
        if (created.isAcknowledgmentRequired && !created.isAcknowledgedByCurrentUser)
          this.pending.unshift(created);
        this.cancelForm();
        this.toastr.success($localize`:@@safety.toast_published:Safety content published.`);
      },
      error: () => {
        this.saving = false;
        this.toastr.error($localize`:@@safety.toast_create_failed:Could not publish the safety content.`);
      }
    });
  }

  askArchive(content: SafetyContent, opener: HTMLElement): void {
    this.archiveOpener = opener;
    this.contentToArchive = content;
  }

  cancelArchive(): void {
    const opener = this.archiveOpener;
    this.contentToArchive = null;
    this.archiveOpener = null;
    Promise.resolve().then(() => opener?.focus());
  }

  confirmArchive(): void {
    const content = this.contentToArchive;
    if (!content) return;
    const opener = this.archiveOpener;
    this.contentToArchive = null;
    this.archiveOpener = null;
    this.safetyService.archiveContent(this.activeCompany.companyId, content.safetyContentId).subscribe({
      next: () => {
        this.contents = this.contents.filter(c => c.safetyContentId !== content.safetyContentId);
        this.pending = this.pending.filter(c => c.safetyContentId !== content.safetyContentId);
        this.totalCount = Math.max(0, this.totalCount - 1);
        if (this.expandedId === content.safetyContentId) this.expandedId = null;
        this.toastr.success($localize`:@@safety.toast_archived:Safety content archived.`);
        if (this.contents.length === 0 && this.page > 1) {
          this.page--;
          this.load();
        }
        Promise.resolve().then(() => (this.addBtn ?? this.listRegion)?.nativeElement.focus());
      },
      error: () => {
        this.toastr.error($localize`:@@safety.toast_archive_failed:Could not archive the safety content.`);
        Promise.resolve().then(() => opener?.focus());
      }
    });
  }

  archiveTitle(): string {
    return $localize`:@@safety.archive_title:Archive ${this.contentToArchive?.title ?? ''}:name:?`;
  }

  archiveLabel(c: SafetyContent): string {
    return $localize`:@@safety.archive_aria:Archive ${c.title}:name:`;
  }

  acknowledgeLabel(c: SafetyContent): string {
    return $localize`:@@safety.ack_aria:I acknowledge ${c.title}:name:`;
  }

  viewContentLabel(c: SafetyContent): string {
    return $localize`:@@safety.view_content_aria:View content for ${c.title}:name:`;
  }

  complianceLabel(c: SafetyContent): string {
    return this.expandedId === c.safetyContentId
      ? $localize`:@@safety.hide_compliance_aria:Hide compliance for ${c.title}:name:`
      : $localize`:@@safety.view_compliance_aria:View compliance for ${c.title}:name:`;
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
    if (!locationId) return $localize`:@@safety.form_all_locations:All locations`;
    return this.locations.find(l => l.locationId === locationId)?.name ?? $localize`:@@safety.location_number:Location #${locationId}:id:`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
