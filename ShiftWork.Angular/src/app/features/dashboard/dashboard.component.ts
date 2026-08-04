import { Component, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable, Subscription, combineLatest, of, BehaviorSubject, interval } from 'rxjs';
import { map, shareReplay, withLatestFrom, filter, switchMap, startWith, catchError } from 'rxjs/operators';
import { MatSidenav } from '@angular/material/sidenav';
import { Router, NavigationEnd } from '@angular/router';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { AuthService } from 'src/app/core/services/auth.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { BillingService, CompanyBillingInfo } from 'src/app/core/services/billing.service';
import { environment } from 'src/environments/environment';
import { TourService } from 'src/app/shared/tour/tour.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: false
})
export class DashboardComponent implements OnDestroy, AfterViewInit {
  @ViewChild('sidenav') sidenav!: MatSidenav;

  activeCompany$: Observable<any>;
  billingInfo$: Observable<CompanyBillingInfo | null>;
  private routerSubscription: Subscription = Subscription.EMPTY;
  private statusRefreshSub: Subscription = Subscription.EMPTY;

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

  constructor(
    private breakpointObserver: BreakpointObserver,
    private authService: AuthService,
    private store: Store<AppState>,
    private router: Router,
    private peopleService: PeopleService,
    public tourService: TourService,
    private permissionService: PermissionService,
    private billingService: BillingService
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
    this.user$ = this.authService.user$;
    this.billingInfo$ = this.billingService.billingInfo$;

    // Load billing info when company changes
    this.activeCompany$.pipe(
      filter(company => !!company),
      switchMap(company => this.billingService.getBillingInfo(company.companyId)),
      catchError(error => {
        console.error('Failed to load billing info:', error);
        return of(null);
      })
    ).subscribe(info => {
      if (info) {
        this.billingService.billingInfoSubject.next(info);
      }
    });

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

  refreshStatus(): void {
    this.refreshTrigger$.next();
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
  }
}
