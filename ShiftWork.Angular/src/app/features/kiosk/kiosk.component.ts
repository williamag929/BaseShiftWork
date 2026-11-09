import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from 'src/app/core/services/auth.service';
import { Company } from 'src/app/core/models/company.model';
import { Subscription, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { KioskService } from './core/services/kiosk.service';
import { LocationService } from 'src/app/core/services/location.service';
import { MatDialog } from '@angular/material/dialog';
import { LocationSelectDialogComponent } from './location-select-dialog/location-select-dialog.component';
import { AdminPasswordDialogComponent } from './admin-password-dialog/admin-password-dialog.component';
import { Location } from 'src/app/core/models/location.model';
import { RouterOutlet } from "@angular/router";
import { DatePipe, CommonModule } from '@angular/common';
import { AnalogClockComponent } from "./analog-clock/analog-clock.component";
import { MatIconModule } from '@angular/material/icon';
import { LzButtonDirective } from 'src/app/shared/ui/button/lz-button.directive';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';

@Component({
  selector: 'app-kiosk',
  templateUrl: './kiosk.component.html',
  standalone: true,
  host: { class: 'block h-screen overflow-hidden' },
  imports: [RouterOutlet, DatePipe, AnalogClockComponent, MatIconModule, LzButtonDirective, CommonModule]
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
      // Only show location dialog if no device location is assigned
      if (!location && this.activeCompany && !this.kioskService.hasDeviceLocation()) {
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
        maxWidth: '95vw',
        panelClass: 'lz-dialog-surface',
        data: { locations },
        disableClose: !this.kioskService.hasDeviceLocation() // Can't close if no location assigned
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          if (result.assignToDevice && result.location) {
            this.kioskService.saveDeviceLocation(result.location);
          } else if (result.location) {
            this.kioskService.setSelectedLocation(result.location);
          }
        }
      });
    });
  }

  openLocationSettings(): void {
    // Open admin password dialog first
    const passwordDialogRef = this.dialog.open(AdminPasswordDialogComponent, {
      width: '350px',
      maxWidth: '95vw',
      panelClass: 'lz-dialog-surface',
      disableClose: true,
      data: { companyId: this.activeCompany?.companyId }
    });

    passwordDialogRef.afterClosed().subscribe(authenticated => {
      if (authenticated) {
        // Clear device location and open location selector
        this.kioskService.clearDeviceLocation();
        this.openLocationSelectDialog();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timeSubscription) {
      this.timeSubscription.unsubscribe();
    }
  }
}
