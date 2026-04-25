import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { filter, switchMap, takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { BulletinService } from 'src/app/core/services/bulletin.service';
import { Bulletin, CreateBulletinDto } from 'src/app/core/models/bulletin.model';
import { PagedResult } from 'src/app/core/models/paged-result.model';
import { LocationService } from 'src/app/core/services/location.service';
import { Location } from 'src/app/core/models/location.model';
import { PermissionService } from 'src/app/core/services/permission.service';

@Component({
  selector: 'app-bulletins',
  templateUrl: './bulletins.component.html',
  styleUrls: ['./bulletins.component.css'],
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
  showForm = false;
  activeFilter: 'all' | 'unread' | 'urgent' = 'all';

  totalCount = 0;
  page = 1;
  pageSize = 25;

  form!: FormGroup;

  private destroy$ = new Subject<void>();

  readonly types = ['General', 'Safety', 'HR', 'Operations', 'Urgent'];
  readonly priorities = ['Low', 'Normal', 'High', 'Critical'];
  readonly statuses = ['Draft', 'Published'];

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
      expiresAt: [null],
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

  load(): Observable<PagedResult<Bulletin>> {
    this.loading = true;
    this.errorMessage = null;
    const obs = this.bulletinService.getBulletins(
      this.activeCompany.companyId,
      undefined, undefined, undefined,
      this.page, this.pageSize
    );
    obs.subscribe({
      next: result => {
        this.bulletins = result.items;
        this.totalCount = result.totalCount;
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load bulletins. Check your connection and try again.';
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

  setFilter(f: 'all' | 'unread' | 'urgent'): void {
    this.activeFilter = f;
    this.applyFilter();
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

  submit(): void {
    if (this.form.invalid) return;
    const dto: CreateBulletinDto = this.form.value;
    this.bulletinService.createBulletin(this.activeCompany.companyId, dto).subscribe({
      next: created => {
        this.bulletins.unshift(created);
        this.applyFilter();
        this.form.reset({ type: 'General', priority: 'Normal', status: 'Published' });
        this.showForm = false;
        this.toastr.success('Bulletin published');
      },
      error: () => this.toastr.error('Failed to create bulletin')
    });
  }

  archive(bulletin: Bulletin, event: Event): void {
    event.stopPropagation();
    this.bulletinService.archiveBulletin(this.activeCompany.companyId, bulletin.bulletinId).subscribe({
      next: () => {
        this.bulletins = this.bulletins.filter(b => b.bulletinId !== bulletin.bulletinId);
        this.applyFilter();
        this.toastr.success('Bulletin archived');
      },
      error: () => this.toastr.error('Failed to archive bulletin')
    });
  }

  priorityColor(priority: string): string {
    switch (priority) {
      case 'Critical': return 'warn';
      case 'High':     return 'accent';
      default:         return 'primary';
    }
  }

  unreadCount(): number {
    return this.bulletins.filter(b => !b.isReadByCurrentUser && b.status === 'Published').length;
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
