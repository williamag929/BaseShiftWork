import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { interval } from 'rxjs';

import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { ActiveSiteService } from 'src/app/core/services/active-site.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { ActiveSiteStatus, ActiveSiteRosterEntry } from 'src/app/core/models/active-site-status.model';

const AUTO_REFRESH_MS = 60_000;

@Component({
  selector: 'app-active-sites',
  templateUrl: './active-sites.component.html',
  styleUrls: ['./active-sites.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class ActiveSitesComponent implements OnInit, OnDestroy {
  sites: ActiveSiteStatus[] = [];
  loading = false;
  error: string | null = null;
  lastRefreshedAt: Date | null = null;
  currentPersonId?: number;

  private activeCompanyId: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<AppState>,
    private activeSiteService: ActiveSiteService,
    private permissionService: PermissionService,
    private authService: AuthService,
  ) {}

  get canView(): boolean {
    return this.permissionService.hasPermission('active-sites.view');
  }

  get canReview(): boolean {
    return this.permissionService.hasPermission('shift-events.geofence-flags.review');
  }

  ngOnInit(): void {
    this.authService.user$.pipe(takeUntil(this.destroy$)).subscribe((p) => {
      this.currentPersonId = p?.personId ?? undefined;
    });

    this.store.select(selectActiveCompany).pipe(takeUntil(this.destroy$)).subscribe((company: { companyId: string } | null) => {
      if (!company) {
        return;
      }
      this.activeCompanyId = company.companyId;
      this.refresh();
    });

    interval(AUTO_REFRESH_MS).pipe(takeUntil(this.destroy$)).subscribe(() => this.refresh());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refresh(): void {
    if (!this.activeCompanyId || !this.canView) {
      return;
    }
    this.loading = true;
    this.error = null;
    this.activeSiteService.getActiveSiteStatus(this.activeCompanyId).subscribe({
      next: (sites) => {
        this.sites = sites;
        this.lastRefreshedAt = new Date();
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load active site status.';
        this.loading = false;
      },
    });
  }

  isFlagged(entry: ActiveSiteRosterEntry): boolean {
    return entry.geofenceStatus === 'Outside' && !entry.geofenceReviewed;
  }

  geofenceBadgeClass(entry: ActiveSiteRosterEntry): string {
    if (entry.geofenceStatus === 'Outside') {
      return entry.geofenceReviewed ? 'badge badge-outside-reviewed' : 'badge badge-outside';
    }
    if (entry.geofenceStatus === 'Inside') {
      return 'badge badge-inside';
    }
    return 'badge badge-unknown';
  }

  timingBadgeClass(entry: ActiveSiteRosterEntry): string {
    switch (entry.timingStatus) {
      case 'Late': return 'badge badge-late';
      case 'Early': return 'badge badge-early';
      case 'NoSchedule': return 'badge badge-unknown';
      default: return 'badge badge-ontime';
    }
  }

  markReviewed(site: ActiveSiteStatus, entry: ActiveSiteRosterEntry): void {
    if (!this.activeCompanyId || !this.canReview) {
      return;
    }
    this.activeSiteService.reviewGeofenceFlag(this.activeCompanyId, entry.shiftEventId, this.currentPersonId).subscribe({
      next: () => {
        entry.geofenceReviewed = true;
      },
      error: () => {
        this.error = 'Failed to mark flag as reviewed.';
      },
    });
  }
}
