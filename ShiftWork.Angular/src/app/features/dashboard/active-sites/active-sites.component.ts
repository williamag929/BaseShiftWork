import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
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
import {
  LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzPageHeaderComponent, LzPanelComponent,
  LzStatusChipComponent, LzTableDirective, LzTableScrollComponent, type LzTone,
} from 'src/app/shared/ui';

const AUTO_REFRESH_MS = 60_000;

@Component({
  selector: 'app-active-sites',
  templateUrl: './active-sites.component.html',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, LzAlertComponent, LzButtonDirective, LzEmptyStateComponent, LzPageHeaderComponent,
    LzPanelComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent,
  ],
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
        this.error = $localize`:@@active_sites.load_error:Could not load active site status.`;
        this.loading = false;
      },
    });
  }

  isFlagged(entry: ActiveSiteRosterEntry): boolean {
    return entry.geofenceStatus === 'Outside' && !entry.geofenceReviewed;
  }

  geofenceTone(entry: ActiveSiteRosterEntry): LzTone {
    if (entry.geofenceStatus === 'Outside') {
      return entry.geofenceReviewed ? 'warning' : 'danger';
    }
    return entry.geofenceStatus === 'Inside' ? 'success' : 'neutral';
  }

  geofenceLabel(entry: ActiveSiteRosterEntry): string {
    if (entry.geofenceStatus === 'Outside') {
      return entry.geofenceReviewed
        ? $localize`:@@active_sites.geofence_outside_reviewed:Outside, reviewed`
        : $localize`:@@active_sites.geofence_outside:Outside`;
    }
    return entry.geofenceStatus === 'Inside'
      ? $localize`:@@active_sites.geofence_inside:Inside`
      : $localize`:@@active_sites.geofence_unknown:Unknown`;
  }

  timingTone(entry: ActiveSiteRosterEntry): LzTone {
    switch (entry.timingStatus) {
      case 'Late': return 'warning';
      case 'Early': return 'info';
      case 'NoSchedule': return 'neutral';
      case 'OnTime': return 'success';
      default: return 'neutral';
    }
  }

  timingLabel(entry: ActiveSiteRosterEntry): string {
    switch (entry.timingStatus) {
      case 'Late': return $localize`:@@active_sites.timing_late:Late`;
      case 'Early': return $localize`:@@active_sites.timing_early:Early`;
      case 'NoSchedule': return $localize`:@@active_sites.timing_no_schedule:No schedule`;
      case 'OnTime': return $localize`:@@active_sites.timing_on_time:On time`;
      default: return $localize`:@@active_sites.timing_unknown:Unknown`;
    }
  }

  reviewLabel(entry: ActiveSiteRosterEntry): string {
    return $localize`:@@active_sites.review_aria:Mark ${entry.name}:name: as reviewed`;
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
        this.error = $localize`:@@active_sites.review_error:Could not mark the flag as reviewed.`;
      },
    });
  }
}
