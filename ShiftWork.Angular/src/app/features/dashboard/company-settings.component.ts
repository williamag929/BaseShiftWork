import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Observable, Subject, of } from 'rxjs';
import { catchError, delay, retry, switchMap, takeUntil, tap } from 'rxjs/operators';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Company } from 'src/app/core/models/company.model';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import {
  LzAlertComponent, LzButtonDirective, LzDialogFrameComponent, LzDialogOverlayComponent, LzEmptyStateComponent, LzFieldComponent,
  LzFieldDirective, LzPageHeaderComponent, LzPagerComponent, LzPanelComponent, LzStatusChipComponent, LzTableDirective,
  LzTableScrollComponent, paginate,
} from 'src/app/shared/ui';
import { CompanySettingsService } from 'src/app/core/services/company-settings.service';
import { CompanySettings } from 'src/app/core/models/company-settings.model';
import { TIMEZONES } from 'src/app/core/data/timezones';
import { Timezone } from 'src/app/core/models/timezone.model';
import { KioskService } from '../kiosk/core/services/kiosk.service';
import { KioskQuestion, CreateKioskQuestionDto } from '../kiosk/core/models/kiosk-question.model';

@Component({
  selector: 'app-company-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatSnackBarModule, MatIconModule, LzAlertComponent, LzButtonDirective, LzDialogFrameComponent,
    LzDialogOverlayComponent, LzEmptyStateComponent, LzFieldComponent, LzFieldDirective, LzPageHeaderComponent, LzPagerComponent,
    LzPanelComponent, LzStatusChipComponent, LzTableDirective, LzTableScrollComponent,
  ],
  templateUrl: './company-settings.component.html'
})
export class CompanySettingsComponent implements OnInit, OnDestroy {
  settings: CompanySettings | null = null;
  loading = false;
  saving = false;
  activeCompany: any;
  loadError = false;
  readonly paginate = paginate;
  qPage = 1;
  qPageSize = 25;
  timezones: Timezone[] = TIMEZONES;
  company$: Observable<Company | null>;
  companyId: string | null = null;
  private destroy$ = new Subject<void>();

  // ── Kiosk question management ────────────────────────────────────────────────
  kioskQuestions: KioskQuestion[] = [];
  kioskQuestionsLoading = false;
  questionsError = false;
  questionError = '';
  questionToDelete: KioskQuestion | null = null;
  deletingQuestionId: number | null = null;
  private questionOpener: HTMLElement | null = null;
  private deleteOpener: HTMLElement | null = null;
  @ViewChild('addQuestionBtn') addQuestionBtn?: ElementRef<HTMLButtonElement>;
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
          this.loadError = false;
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
                this.loadError = true;
                this.snackBar.open($localize`:@@settings.toast_init_failed:Unable to initialize settings. Please try again.`, this.closeLabel, { duration: 5000 });
              } else {
                console.error('Failed to load settings:', err);
                this.loadError = true;
                this.snackBar.open($localize`:@@settings.toast_load_failed:Could not load settings.`, this.closeLabel, { duration: 3000 });
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
          this.kioskQuestions = [];
          this.loadKioskQuestions();
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
        this.snackBar.open($localize`:@@settings.toast_saved:Settings saved.`, this.closeLabel, { duration: 3000 });
        this.saving = false;
      },
      error: (error) => {
        console.error('Failed to save settings:', error);
        this.snackBar.open($localize`:@@settings.toast_save_failed:Could not save settings.`, this.closeLabel, { duration: 3000 });
        this.saving = false;
      }
    });
  }

  // ── Kiosk question management ────────────────────────────────────────────────

  loadKioskQuestions(): void {
    if (!this.companyId) return;
    this.kioskQuestionsLoading = true;
    this.questionsError = false;
    this.kioskService.getManagementQuestions(this.companyId).subscribe({
      next: (questions) => {
        this.kioskQuestions = questions;
        this.kioskQuestionsLoading = false;
      },
      error: () => {
        this.questionsError = true;
        this.snackBar.open($localize`:@@settings.toast_questions_load_failed:Could not load kiosk questions.`, this.closeLabel, { duration: 3000 });
        this.kioskQuestionsLoading = false;
      }
    });
  }

  get closeLabel(): string {
    return $localize`:@@common.close:Close`;
  }

  get questionDialogOpen(): boolean {
    return this.showQuestionForm;
  }

  get questionDialogTitle(): string {
    return this.editingQuestion
      ? $localize`:@@settings.edit_question:Edit question`
      : $localize`:@@settings.new_question:New question`;
  }

  get deleteQuestionTitle(): string {
    return $localize`:@@settings.delete_question_title:Delete ${this.questionToDelete?.questionText ?? ''}:name:?`;
  }

  questionTypeLabel(type: string): string {
    switch (type) {
      case 'yes_no': return $localize`:@@settings.q_yes_no:Yes or no`;
      case 'multiple_choice': return $localize`:@@settings.q_multiple_choice:Multiple choice`;
      case 'text': return $localize`:@@settings.q_free_text:Free text`;
      default: return type;
    }
  }

  editQuestionLabel(q: KioskQuestion): string {
    return $localize`:@@settings.edit_question_aria:Edit ${q.questionText}:name:`;
  }

  deleteQuestionLabel(q: KioskQuestion): string {
    return $localize`:@@settings.delete_question_aria:Delete ${q.questionText}:name:`;
  }

  openNewQuestionForm(opener?: HTMLElement): void {
    this.questionOpener = opener ?? null;
    this.questionError = '';
    this.editingQuestion = null;
    this.questionForm = this.blankQuestionForm();
    this.questionOptionsText = '';
    this.showQuestionForm = true;
  }

  openEditQuestionForm(q: KioskQuestion, opener?: HTMLElement): void {
    this.questionOpener = opener ?? null;
    this.questionError = '';
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
    this.restoreQuestionFocus();
  }

  private restoreQuestionFocus(): void {
    const opener = this.questionOpener;
    this.questionOpener = null;
    Promise.resolve().then(() => (opener?.isConnected ? opener : this.addQuestionBtn?.nativeElement)?.focus());
  }

  saveQuestion(): void {
    if (!this.companyId || !this.questionForm.questionText.trim()) return;

    this.questionForm.options = this.questionForm.questionType === 'multiple_choice'
      ? this.questionOptionsText.split('\n').map(o => o.trim()).filter(o => o.length > 0)
      : [];

    this.savingQuestion = true;
    this.questionError = '';

    if (this.editingQuestion) {
      this.kioskService.updateQuestion(this.companyId, this.editingQuestion.kioskQuestionId, this.questionForm).subscribe({
        next: (updated) => {
          const idx = this.kioskQuestions.findIndex(q => q.kioskQuestionId === updated.kioskQuestionId);
          if (idx !== -1) this.kioskQuestions[idx] = updated;
          this.showQuestionForm = false;
          this.savingQuestion = false;
          this.restoreQuestionFocus();
          this.snackBar.open($localize`:@@settings.toast_question_updated:Question updated.`, this.closeLabel, { duration: 2000 });
        },
        error: () => {
          this.questionError = $localize`:@@settings.toast_question_update_failed:Could not update the question.`;
          this.savingQuestion = false;
        }
      });
    } else {
      this.kioskService.createQuestion(this.companyId, this.questionForm).subscribe({
        next: (created) => {
          this.kioskQuestions.push(created);
          this.showQuestionForm = false;
          this.savingQuestion = false;
          this.restoreQuestionFocus();
          this.snackBar.open($localize`:@@settings.toast_question_created:Question created.`, this.closeLabel, { duration: 2000 });
        },
        error: () => {
          this.questionError = $localize`:@@settings.toast_question_create_failed:Could not create the question.`;
          this.savingQuestion = false;
        }
      });
    }
  }

  askDeleteQuestion(q: KioskQuestion, opener: HTMLElement): void {
    this.deleteOpener = opener;
    this.questionToDelete = q;
  }

  cancelDeleteQuestion(): void {
    const opener = this.deleteOpener;
    this.questionToDelete = null;
    this.deleteOpener = null;
    Promise.resolve().then(() => opener?.focus());
  }

  confirmDeleteQuestion(): void {
    const q = this.questionToDelete;
    if (!q || !this.companyId) return;
    const opener = this.deleteOpener;
    this.questionToDelete = null;
    this.deleteOpener = null;
    this.deletingQuestionId = q.kioskQuestionId;
    this.kioskService.deleteQuestion(this.companyId, q.kioskQuestionId).subscribe({
      next: () => {
        this.kioskQuestions = this.kioskQuestions.filter(x => x.kioskQuestionId !== q.kioskQuestionId);
        this.qPage = Math.min(this.qPage, Math.max(1, Math.ceil(this.kioskQuestions.length / this.qPageSize)));
        this.deletingQuestionId = null;
        this.snackBar.open($localize`:@@settings.toast_question_deleted:Question deleted.`, this.closeLabel, { duration: 2000 });
        Promise.resolve().then(() => this.addQuestionBtn?.nativeElement.focus());
      },
      error: () => {
        this.deletingQuestionId = null;
        this.snackBar.open($localize`:@@settings.toast_question_delete_failed:Could not delete the question.`, this.closeLabel, { duration: 3000 });
        Promise.resolve().then(() => opener?.focus());
      }
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
