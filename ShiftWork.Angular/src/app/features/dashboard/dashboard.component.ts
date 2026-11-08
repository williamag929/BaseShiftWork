import { Component, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable, Subscription, combineLatest, of, BehaviorSubject, interval } from 'rxjs';
import { map, shareReplay, withLatestFrom, filter, switchMap, startWith, catchError, distinctUntilChanged } from 'rxjs/operators';
import { MatSidenav } from '@angular/material/sidenav';
import { Router, NavigationEnd } from '@angular/router';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { AuthService } from 'src/app/core/services/auth.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { CredentialService } from 'src/app/core/services/credential.service';
import { environment } from 'src/environments/environment';
import { TourService } from 'src/app/shared/tour/tour.service';
import { BillingService } from 'src/app/core/services/billing.service';
import { BillingBanner, billingBannerFor } from 'src/app/core/models/billing.model';
import { ProcoreService } from 'src/app/core/services/procore.service';
import { NAV_SECTIONS, NavSection, procoreSyncLabel, visibleSections } from './nav/nav.config';

const NAV_COLLAPSED_KEY = 'lz.nav.collapsed';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: false
})
export class DashboardComponent implements OnDestroy, AfterViewInit {
  @ViewChild('sidenav') sidenav!: MatSidenav;

  activeCompany$: Observable<any>;
  private routerSubscription: Subscription = Subscription.EMPTY;
  private statusRefreshSub: Subscription = Subscription.EMPTY;
  private billingRefreshSub: Subscription = Subscription.EMPTY;
  billingBanner$: Observable<BillingBanner | null>;

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  user$: Observable<any>;
  personStatus$: Observable<string | null> = of(null);
  lastStatusUpdate: Date | null = null;
  refreshing = false;
  private refreshTrigger$ = new BehaviorSubject<void>(undefined);
  private statusRefreshIntervalMs = environment.kioskStatusRefreshMs || 45000;

  /** Expiring + expired credential count for the sidenav badge; null/0 renders no badge. */
  expiringCredentialsCount$: Observable<number | null>;

  procoreChip$: Observable<ReturnType<typeof procoreSyncLabel>>;
  collapsed = DashboardComponent.readCollapsed();

  private static readCollapsed(): boolean {
    try {
      return localStorage.getItem(NAV_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  constructor(
    private breakpointObserver: BreakpointObserver,
    private authService: AuthService,
    private store: Store<AppState>,
    private router: Router,
    private peopleService: PeopleService,
    public tourService: TourService,
    private permissionService: PermissionService,
    private credentialService: CredentialService,
    private billingService: BillingService,
    private procoreService: ProcoreService
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
    this.user$ = this.authService.user$;

    this.billingRefreshSub = this.activeCompany$
      .pipe(filter((c: any) => !!c?.companyId))
      .subscribe((c: any) => this.billingService.refresh(c.companyId));
    this.billingBanner$ = this.billingService.summary$.pipe(map(billingBannerFor));

    this.procoreChip$ = this.activeCompany$.pipe(
      filter((c: any) => !!c?.companyId),
      map((c: any) => c.companyId as string),
      distinctUntilChanged(),
      switchMap((companyId: string) => this.procoreService.getConnection(companyId).pipe(catchError(() => of(null)))),
      map(conn => procoreSyncLabel(conn, new Date())),
      startWith(null as ReturnType<typeof procoreSyncLabel>)
    );

    this.expiringCredentialsCount$ = this.activeCompany$.pipe(
      filter((company: any) => !!company && this.hasPermission('credentials.track')),
      switchMap((company: any): Observable<number | null> =>
        this.credentialService.getExpiring(company.companyId).pipe(
          map(summary => summary.expiredCount + summary.expiringSoonCount),
          catchError(() => of(null))
        )
      ),
      startWith(null as number | null)
    );

    // Combine active company, user, and refresh trigger to load live person status
    this.personStatus$ = combineLatest([
      this.activeCompany$, 
      this.user$, 
      this.refreshTrigger$
    ]).pipe(
      filter(([company, user]) => !!company && !!user?.personId),
      switchMap(([company, user]: any) => {
        this.refreshing = true;
        return this.peopleService.getPersonStatus(company.companyId, user.personId).pipe(
          map(status => {
            this.refreshing = false;
            this.lastStatusUpdate = new Date();
            return status || user.statusShiftWork || null;
          }),
          catchError(() => {
            this.refreshing = false;
            this.lastStatusUpdate = new Date();
            return of(user.statusShiftWork || null);
          })
        );
      }),
      startWith(null)
    );

    // Start periodic auto-refresh
    this.statusRefreshSub = interval(this.statusRefreshIntervalMs).subscribe(() => {
      this.refreshStatus();
    });
  }

  ngAfterViewInit(): void {
    this.routerSubscription = this.router.events.pipe(
      withLatestFrom(this.isHandset$),
      filter(([event, isHandset]) => isHandset && event instanceof NavigationEnd)
    ).subscribe(() => {
      if (this.sidenav) {
        this.sidenav.close();
      }
    });

    // Auto-start tour for first-time users
    if (this.tourService.shouldAutoStart()) {
      setTimeout(() => this.tourService.startTour(), 800);
    }
  }

  isOnShift(status: string): boolean {
    return status.startsWith('OnShift');
  }

  statusLabel(status: string): string {
    return this.isOnShift(status)
      ? $localize`:@@nav.status.on_shift:On shift`
      : $localize`:@@nav.status.off_shift:Off shift`;
  }

  refreshStatus(): void {
    this.refreshTrigger$.next();
  }

  get sections(): NavSection[] {
    return visibleSections(NAV_SECTIONS, key => this.hasPermission(key));
  }

  trackById(_: number, entry: { id: string }): string {
    return entry.id;
  }

  get collapseLabel(): string {
    return this.collapsed
      ? $localize`:@@nav.expand:Expand navigation`
      : $localize`:@@nav.collapse:Collapse navigation`;
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, this.collapsed ? '1' : '0');
    } catch {
      // storage unavailable (private mode); collapse state is session-only
    }
  }

  hasPermission(key: string): boolean {
    return this.permissionService.hasPermission(key);
  }

  logout() {
    this.authService.signOut();
    this.router.navigate(['/sign-in']);
  }

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe();
    this.statusRefreshSub.unsubscribe();
    this.billingRefreshSub.unsubscribe();
  }
}
