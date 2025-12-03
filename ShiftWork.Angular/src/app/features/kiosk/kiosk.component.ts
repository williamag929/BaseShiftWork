import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from 'src/app/core/services/auth.service';
import { Company } from 'src/app/core/models/company.model';
import { Subscription, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { KioskService } from './core/services/kiosk.service';
import { LocationService } from 'src/app/core/services/location.service';
import { MatDialog } from '@angular/material/dialog';
import { LocationSelectDialogComponent } from './location-select-dialog/location-select-dialog.component';
import { Location } from 'src/app/core/models/location.model';
import { RouterOutlet } from "@angular/router";
import { DatePipe } from '@angular/common';
import { AnalogClockComponent } from "./analog-clock/analog-clock.component";
import { MatDialogModule } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';

@Component({
  selector: 'app-kiosk',
  templateUrl: './kiosk.component.html',
  styleUrls: ['./kiosk.component.css'],
  standalone: true,
  imports: [RouterOutlet, DatePipe, AnalogClockComponent, MatDialogModule]
})
export class KioskComponent implements OnInit, OnDestroy {
  timeSubscription!: Subscription;
  currentTime!: Date;
  selectedLocation: Location | null = null;
  activeCompany$: Observable<any>;
  activeCompany: any;

  constructor(
    private authService: AuthService,
    private kioskService: KioskService,
    private locationService: LocationService,
    private dialog: MatDialog,
    private readonly store: Store<AppState>
  ) {
    this.timeSubscription = new Subscription();
    this.currentTime = new Date();
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
      this.activeCompany$.subscribe((company: { companyId: string }) => {
        if (company) {
          this.activeCompany = company;
        }
    });

    this.kioskService.selectedLocation$.subscribe(location => {
      this.selectedLocation = location;
      if (!location && this.activeCompany) {
        this.openLocationSelectDialog();
      }
    });

    this.timeSubscription = timer(0, 1000)
      .pipe(map(() => new Date()))
      .subscribe(time => {
        this.currentTime = time;
      });
  }

  openLocationSelectDialog(): void {
    if (!this.activeCompany) {
      return;
    }
    this.locationService.getLocations(this.activeCompany.companyId).subscribe(locations => {
      const dialogRef = this.dialog.open(LocationSelectDialogComponent, {
        width: '400px',
        data: { locations }
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.kioskService.setSelectedLocation(result);
        }
      });
    });
  }

  ngOnDestroy(): void {
    if (this.timeSubscription) {
      this.timeSubscription.unsubscribe();
    }
  }
}
