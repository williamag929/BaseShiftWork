import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { BulletinService } from 'src/app/core/services/bulletin.service';
import { Bulletin, CreateBulletinDto } from 'src/app/core/models/bulletin.model';
import { LocationService } from 'src/app/core/services/location.service';
import { Location } from 'src/app/core/models/location.model';
import { PermissionService } from 'src/app/core/services/permission.service';

@Component({
  selector: 'app-bulletins',
  templateUrl: './bulletins.component.html',
  standalone: false
})
export class BulletinsComponent implements OnInit, OnDestroy {
  activeCompany$: Observable<any>;
  activeCompany: any;

  bulletins: Bulletin[] = [];
  filtered: Bulletin[] = [];
  locations: Location[] = [];
  loading = false;
  errorMessage: string | null = null;
  panelOpen = false;
  saving = false;
  openerEl: HTMLElement | null = null;
  bulletinToArchive: Bulletin | null = null;
  private archiveOpener: HTMLElement | null = null;
  private filterOptionsCache: { unread: number; options: { value: string; label: string }[] } | null = null;
  @ViewChild('addBtn') private addBtn?: ElementRef<HTMLElement>;
  @ViewChild('listRegion') private listRegion?: ElementRef<HTMLElement>;
  activeFilter: 'all' | 'unread' | 'urgent' = 'all';

  totalCount = 0;
  page = 1;
  pageSize = 25;

  form!: FormGroup;

  private destroy$ = new Subject<void>();

  readonly types = ['General', 'Safety', 'HR', 'Operations', 'Urgent'];
  readonly priorities = ['Low', 'Normal', 'High', 'Critical'];
  readonly statuses = ['Draft', 'Published'];

  readonly typeLabels: Record<string, string> = {
    General: $localize`:@@bulletins.type_general:General`,
    Safety: $localize`:@@bulletins.type_safety:Safety`,
    HR: $localize`:@@bulletins.type_hr:HR`,
    Operations: $localize`:@@bulletins.type_operations:Operations`,
    Urgent: $localize`:@@bulletins.type_urgent:Urgent`
  };
  readonly priorityLabels: Record<string, string> = {
    Low: $localize`:@@bulletins.priority_low:Low`,
    Normal: $localize`:@@bulletins.priority_normal:Normal`,
    High: $localize`:@@bulletins.priority_high:High`,
    Critical: $localize`:@@bulletins.priority_critical:Critical`
  };
  readonly statusLabels: Record<string, string> = {
    Draft: $localize`:@@bulletins.status_draft:Draft`,
    Published: $localize`:@@bulletins.status_published:Published`
  };
  readonly addLabel = $localize`:@@bulletins.new_btn:New bulletin`;
  readonly allCaughtUp = $localize`:@@bulletins.empty_unread:All caught up — no unread bulletins.`;
  readonly noUrgent = $localize`:@@bulletins.empty_urgent:No urgent bulletins right now.`;
  readonly noBulletins = $localize`:@@bulletins.no_bulletins:No bulletins yet`;
  readonly emptyAllBody = $localize`:@@bulletins.empty_all:Create the first one to get started.`;
  readonly titleRequired = $localize`:@@bulletins.title_error:Title is required`;
  readonly contentRequired = $localize`:@@bulletins.content_error:Content is required`;

  get canCreate(): boolean { return this.permissionService.hasPermission('bulletins.create'); }
  get canArchive(): boolean { return this.permissionService.hasPermission('bulletins.delete'); }

  constructor(
    private bulletinService: BulletinService,
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
      content: ['', Validators.required],
      type: ['General', Validators.required],
      priority: ['Normal', Validators.required],
      locationId: [null],
      expiresAt: [''],
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
    this.bulletinService.getBulletins(
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
        this.bulletins = result.items;
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.errorMessage = $localize`:@@bulletins.load_error:Could not load bulletins. Check your connection and try again.`;
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

  retry(): void {
    this.load();
  }

  setFilter(f: string): void {
    this.activeFilter = f as 'all' | 'unread' | 'urgent';
    this.applyFilter();
  }

  get filterOptions(): { value: string; label: string }[] {
    const unread = this.unreadCount();
    if (this.filterOptionsCache?.unread !== unread) {
      this.filterOptionsCache = {
        unread,
        options: [
          { value: 'all', label: $localize`:@@bulletins.filter_all:All` },
          { value: 'unread', label: unread > 0 ? $localize`:@@bulletins.filter_unread_count:Unread (${unread}:count:)` : $localize`:@@bulletins.filter_unread:Unread` },
          { value: 'urgent', label: $localize`:@@bulletins.filter_urgent:Urgent` }
        ]
      };
    }
    return this.filterOptionsCache.options;
  }

  applyFilter(): void {
    switch (this.activeFilter) {
      case 'unread':
        this.filtered = this.bulletins.filter(b => !b.isReadByCurrentUser && b.status === 'Published');
        break;
      case 'urgent':
        this.filtered = this.bulletins.filter(b => b.priority === 'Critical' || b.type === 'Urgent');
        break;
      default:
        this.filtered = this.bulletins.filter(b => b.status !== 'Archived');
    }
  }

  markAsRead(bulletin: Bulletin): void {
    if (bulletin.isReadByCurrentUser) return;
    this.bulletinService.markAsRead(this.activeCompany.companyId, bulletin.bulletinId).subscribe({
      next: () => {
        bulletin.isReadByCurrentUser = true;
        bulletin.totalReads++;
      }
    });
  }

  openNew(): void {
    this.cancelForm();
    this.panelOpen = true;
  }

  cancelForm(): void {
    this.panelOpen = false;
    this.form.reset({ type: 'General', priority: 'Normal', status: 'Published' });
  }

  submit(): void {
    if (this.form.invalid || this.saving) return;
    const raw = this.form.value;
    const dto: CreateBulletinDto = {
      ...raw,
      expiresAt: raw.expiresAt ? new Date(`${raw.expiresAt}T00:00:00`).toISOString() : null
    };
    this.saving = true;
    this.bulletinService.createBulletin(this.activeCompany.companyId, dto).subscribe({
      next: created => {
        this.saving = false;
        this.bulletins.unshift(created);
        this.totalCount++;
        this.applyFilter();
        this.cancelForm();
        this.toastr.success($localize`:@@bulletins.toast_published:Bulletin published.`);
      },
      error: () => {
        this.saving = false;
        this.toastr.error($localize`:@@bulletins.toast_create_failed:Could not publish the bulletin.`);
      }
    });
  }

  askArchive(bulletin: Bulletin, opener: HTMLElement): void {
    this.archiveOpener = opener;
    this.bulletinToArchive = bulletin;
  }

  cancelArchive(): void {
    const opener = this.archiveOpener;
    this.bulletinToArchive = null;
    this.archiveOpener = null;
    Promise.resolve().then(() => opener?.focus());
  }

  confirmArchive(): void {
    const bulletin = this.bulletinToArchive;
    if (!bulletin) return;
    const opener = this.archiveOpener;
    this.bulletinToArchive = null;
    this.archiveOpener = null;
    this.bulletinService.archiveBulletin(this.activeCompany.companyId, bulletin.bulletinId).subscribe({
      next: () => {
        this.bulletins = this.bulletins.filter(b => b.bulletinId !== bulletin.bulletinId);
        this.totalCount = Math.max(0, this.totalCount - 1);
        this.applyFilter();
        this.toastr.success($localize`:@@bulletins.toast_archived:Bulletin archived.`);
        if (this.bulletins.length === 0 && this.page > 1) {
          this.page--;
          this.load();
        }
        Promise.resolve().then(() => (this.addBtn ?? this.listRegion)?.nativeElement.focus());
      },
      error: () => {
        this.toastr.error($localize`:@@bulletins.toast_archive_failed:Could not archive the bulletin.`);
        Promise.resolve().then(() => opener?.focus());
      }
    });
  }

  archiveTitle(): string {
    return $localize`:@@bulletins.archive_title:Archive ${this.bulletinToArchive?.title ?? ''}:name:?`;
  }

  archiveLabel(b: Bulletin): string {
    return $localize`:@@bulletins.archive_aria:Archive ${b.title}:name:`;
  }

  markReadLabel(b: Bulletin): string {
    return $localize`:@@bulletins.mark_read_aria:Mark ${b.title}:name: as read`;
  }

  unreadCount(): number {
    return this.bulletins.filter(b => !b.isReadByCurrentUser && b.status === 'Published').length;
  }

  locationName(locationId?: number): string {
    if (!locationId) return $localize`:@@bulletins.form_all_locations:All locations`;
    return this.locations.find(l => l.locationId === locationId)?.name ?? $localize`:@@bulletins.location_number:Location #${locationId}:id:`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
