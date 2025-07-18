import { Component, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatSidenav } from '@angular/material/sidenav';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state'; 
import { combineLatest } from 'rxjs';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';


@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: false
})
export class DashboardComponent implements OnInit {
  isMenuCollapsed = true;

  activeCompany$: Observable<any>;
  activeCompany: any;
  

constructor(
    private authService: AuthService,
    private router: Router,
    private store: Store<AppState>
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
    
    this.activeCompany$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
        console.log('Active company set:', this.activeCompany);
      } else {
        console.log('No active company found');
      }
    });


    let token = authService.getToken();
        console.log('Token:', token.then((token) => {
      if (token) {
        console.log('Token exists:', token) 
        return token;
      } else {
        //try get token from sessionStorage
        let sessionToken = sessionStorage.getItem('authToken');
        if (sessionToken) {
          console.log('Token from sessionStorage:', sessionToken);
          return sessionToken;
        }else{
        console.log('Token does not exist')
        return null;
        }
      }
    }));
    

  }

  ngOnInit(): void {
  }

  logout() {
    this.authService.signOut();
    this.router.navigate(['/sign-in']);
  }


/*
  private breakpointObserver = inject(BreakpointObserver);
  isHandset$: Observable<boolean> = combineLatest([
    this.breakpointObserver.observe(Breakpoints.Handset), 
    this.breakpointObserver.observe(Breakpoints.Tablet), 
  ]).pipe(
    map(([handset, tablet]) => handset.matches || tablet.matches)
  );
*/
}
