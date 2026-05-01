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
import { TIMEZONES } from 'src/app/core/data/timezones';
import { Timezone } from 'src/app/core/models/timezone.model';
import { KioskService } from '../kiosk/core/services/kiosk.service';
import { KioskQuestion, CreateKioskQuestionDto } from '../kiosk/core/models/kiosk-question.model';

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
  timezones: Timezone[] = TIMEZONES;
  company$: Observable<Company | null>;
  companyId: string | null = null;
  private destroy$ = new Subject<void>();

  // ── Kiosk question management ────────────────────────────────────────────────
  kioskQuestions: KioskQuestion[] = [];
  kioskQuestionsLoading = false;
  showQuestionForm = false;
  editingQuestion: KioskQuestion | null = null;
  questionForm: CreateKioskQuestionDto = this.blankQuestionForm();
  savingQuestion = false;
  questionOptionsText = '';

  constructor(
    private settingsService: CompanySettingsService,
    private kioskService: KioskService,
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
    if (tab === 'kiosk' && this.companyId && this.kioskQuestions.length === 0) {
      this.loadKioskQuestions();
    }
  }

  // ── Kiosk question management ────────────────────────────────────────────────

  loadKioskQuestions(): void {
    if (!this.companyId) return;
    this.kioskQuestionsLoading = true;
    this.kioskService.getManagementQuestions(this.companyId).subscribe({
      next: (questions) => {
        this.kioskQuestions = questions;
        this.kioskQuestionsLoading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load kiosk questions', 'Close', { duration: 3000 });
        this.kioskQuestionsLoading = false;
      }
    });
  }

  openNewQuestionForm(): void {
    this.editingQuestion = null;
    this.questionForm = this.blankQuestionForm();
    this.questionOptionsText = '';
    this.showQuestionForm = true;
  }

  openEditQuestionForm(q: KioskQuestion): void {
    this.editingQuestion = q;
    this.questionForm = {
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options ? [...q.options] : [],
      isRequired: q.isRequired,
      isActive: q.isActive,
      displayOrder: q.displayOrder,
    };
    this.questionOptionsText = q.options ? q.options.join('\n') : '';
    this.showQuestionForm = true;
  }

  cancelQuestionForm(): void {
    this.showQuestionForm = false;
    this.editingQuestion = null;
  }

  saveQuestion(): void {
    if (!this.companyId || !this.questionForm.questionText.trim()) return;

    this.questionForm.options = this.questionForm.questionType === 'multiple_choice'
      ? this.questionOptionsText.split('\n').map(o => o.trim()).filter(o => o.length > 0)
      : [];

    this.savingQuestion = true;

    if (this.editingQuestion) {
      this.kioskService.updateQuestion(this.companyId, this.editingQuestion.kioskQuestionId, this.questionForm).subscribe({
        next: (updated) => {
          const idx = this.kioskQuestions.findIndex(q => q.kioskQuestionId === updated.kioskQuestionId);
          if (idx !== -1) this.kioskQuestions[idx] = updated;
          this.showQuestionForm = false;
          this.savingQuestion = false;
          this.snackBar.open('Question updated', 'Close', { duration: 2000 });
        },
        error: () => {
          this.snackBar.open('Failed to update question', 'Close', { duration: 3000 });
          this.savingQuestion = false;
        }
      });
    } else {
      this.kioskService.createQuestion(this.companyId, this.questionForm).subscribe({
        next: (created) => {
          this.kioskQuestions.push(created);
          this.showQuestionForm = false;
          this.savingQuestion = false;
          this.snackBar.open('Question created', 'Close', { duration: 2000 });
        },
        error: () => {
          this.snackBar.open('Failed to create question', 'Close', { duration: 3000 });
          this.savingQuestion = false;
        }
      });
    }
  }

  deleteQuestion(q: KioskQuestion): void {
    if (!this.companyId) return;
    if (!confirm(`Delete "${q.questionText}"?`)) return;

    this.kioskService.deleteQuestion(this.companyId, q.kioskQuestionId).subscribe({
      next: () => {
        this.kioskQuestions = this.kioskQuestions.filter(x => x.kioskQuestionId !== q.kioskQuestionId);
        this.snackBar.open('Question deleted', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to delete question', 'Close', { duration: 3000 })
    });
  }

  private blankQuestionForm(): CreateKioskQuestionDto {
    return {
      questionText: '',
      questionType: 'yes_no',
      options: [],
      isRequired: false,
      isActive: true,
      displayOrder: 0,
    };
  }
}
