import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Observable, Subject, of } from 'rxjs';
import { catchError, delay, retry, switchMap, takeUntil, tap } from 'rxjs/operators';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Company } from 'src/app/core/models/company.model';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CompanySettingsService } from 'src/app/core/services/company-settings.service';
import { CompanySettings } from 'src/app/core/models/company-settings.model';

@Component({
  selector: 'app-company-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './company-settings.component.html',
  styleUrls: ['./company-settings.component.css']
})
export class CompanySettingsComponent implements OnInit, OnDestroy {
  settings: CompanySettings | null = null;
  loading = false;
  saving = false;
  activeCompany: any;
  activeTab: string = 'time-regional';
  company$: Observable<Company | null>;
  companyId: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private settingsService: CompanySettingsService,
    private store: Store<AppState>,
    private snackBar: MatSnackBar
  ) {
    this.company$ = this.store.select(selectActiveCompany);


    this.company$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
        console.log('Active company set:', this.activeCompany);
      } else {
        console.log('No active company found');
      }
    });

  }

  ngOnInit(): void {
    this.company$
      .pipe(
        takeUntil(this.destroy$),
        tap(() => {
          this.loading = true;
        }),
        switchMap(company => {
          if (!company || !company.companyId) {
            this.companyId = null;
            this.settings = null;
            this.loading = false;
            return of(null);
          }
          this.companyId = company.companyId;
          return this.settingsService.getSettings(company.companyId).pipe(
            retry({
              count: 1,
              delay: (error, retryCount) => {
                // If 404 on first attempt, backend is creating defaults - retry once after 500ms
                if (error.status === 404 && retryCount === 1) {
                  console.log('Settings not found, retrying after backend initialization...');
                  return of(error).pipe(delay(500));
                }
                throw error;
              }
            }),
            catchError(err => {
              if (err.status === 404) {
                console.error('Settings still not found after retry:', err);
                this.snackBar.open('Unable to initialize settings. Please try again.', 'Close', { duration: 5000 });
              } else {
                console.error('Failed to load settings:', err);
                this.snackBar.open('Failed to load settings', 'Close', { duration: 3000 });
              }
              this.loading = false;
              return of(null);
            })
          );
        })
      )
      .subscribe(settings => {
        if (settings) {
          this.settings = settings;
        }
        this.loading = false;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  saveSettings(): void {
    if (!this.companyId || !this.settings) return;

    this.saving = true;
    this.settingsService.updateSettings(this.companyId, this.settings).subscribe({
      next: () => {
        this.snackBar.open('Settings saved successfully', 'Close', { duration: 3000 });
        this.saving = false;
      },
      error: (error) => {
        console.error('Failed to save settings:', error);
        this.snackBar.open('Failed to save settings', 'Close', { duration: 3000 });
        this.saving = false;
      }
    });
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
}
