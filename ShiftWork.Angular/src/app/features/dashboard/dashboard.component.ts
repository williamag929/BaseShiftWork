import { Component, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable, Subscription } from 'rxjs';
import { map, shareReplay, withLatestFrom, filter } from 'rxjs/operators';
import { MatSidenav } from '@angular/material/sidenav';
import { Router, NavigationEnd } from '@angular/router';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { AuthService } from 'src/app/core/services/auth.service';

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

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  user$: Observable<any>;

  constructor(
    private breakpointObserver: BreakpointObserver,
    private authService: AuthService,
    private store: Store<AppState>,
    private router: Router
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
    this.user$ = this.authService.user$;
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
  }

  logout() {
    this.authService.signOut();
    this.router.navigate(['/sign-in']);
  }

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe();
  }
}
