import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { filter, switchMap, takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { SafetyService } from 'src/app/core/services/safety.service';
import { SafetyContent, AcknowledgmentStatus, CreateSafetyContentDto } from 'src/app/core/models/safety.model';

@Component({
  selector: 'app-safety',
  templateUrl: './safety.component.html',
  styleUrls: ['./safety.component.css'],
  standalone: false
})
export class SafetyComponent implements OnInit, OnDestroy {
  activeCompany$: Observable<any>;
  activeCompany: any;

  contents: SafetyContent[] = [];
  pending: SafetyContent[] = [];
  activeTab: 'all' | 'pending' = 'all';
  loading = false;
  showForm = false;

  complianceMap = new Map<string, AcknowledgmentStatus>();
  expandedId: string | null = null;

  form!: FormGroup;

  readonly types = ['ToolboxTalk', 'SafetyDataSheet', 'Orientation', 'InstructionalVideo', 'Training'];
  readonly statuses = ['Draft', 'Published'];

  private destroy$ = new Subject<void>();

  constructor(
    private safetyService: SafetyService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private store: Store<AppState>
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      type: ['ToolboxTalk', Validators.required],
      textContent: [''],
      isAcknowledgmentRequired: [true],
      locationId: [null],
      scheduledFor: [null],
      status: ['Published', Validators.required]
    });

    this.activeCompany$.pipe(
      filter(c => !!c),
      switchMap(company => {
        this.activeCompany = company;
        return this.load();
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  load(): Observable<SafetyContent[]> {
    this.loading = true;
    const obs = this.safetyService.getContents(this.activeCompany.companyId);
    obs.subscribe({
      next: contents => {
        this.contents = contents;
        this.pending = contents.filter(c => c.isAcknowledgmentRequired && !c.isAcknowledgedByCurrentUser && c.status === 'Published');
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load safety content');
        this.loading = false;
      }
    });
    return obs;
  }

  acknowledge(content: SafetyContent): void {
    this.safetyService.acknowledge(this.activeCompany.companyId, content.safetyContentId).subscribe({
      next: () => {
        content.isAcknowledgedByCurrentUser = true;
        this.pending = this.pending.filter(p => p.safetyContentId !== content.safetyContentId);
        this.toastr.success('Acknowledged');
      },
      error: () => this.toastr.error('Failed to acknowledge')
    });
  }

  toggleCompliance(content: SafetyContent): void {
    if (this.expandedId === content.safetyContentId) {
      this.expandedId = null;
      return;
    }
    this.expandedId = content.safetyContentId;
    if (!this.complianceMap.has(content.safetyContentId)) {
      this.safetyService.getAcknowledgmentStatus(this.activeCompany.companyId, content.safetyContentId).subscribe({
        next: status => this.complianceMap.set(content.safetyContentId, status),
        error: () => this.toastr.error('Failed to load compliance data')
      });
    }
  }

  submit(): void {
    if (this.form.invalid) return;
    const dto: CreateSafetyContentDto = this.form.value;
    this.safetyService.createContent(this.activeCompany.companyId, dto).subscribe({
      next: created => {
        this.contents.unshift(created);
        if (created.isAcknowledgmentRequired && !created.isAcknowledgedByCurrentUser)
          this.pending.unshift(created);
        this.form.reset({ type: 'ToolboxTalk', isAcknowledgmentRequired: true, status: 'Published' });
        this.showForm = false;
        this.toastr.success('Safety content published');
      },
      error: () => this.toastr.error('Failed to create safety content')
    });
  }

  archive(content: SafetyContent, event: Event): void {
    event.stopPropagation();
    this.safetyService.archiveContent(this.activeCompany.companyId, content.safetyContentId).subscribe({
      next: () => {
        this.contents = this.contents.filter(c => c.safetyContentId !== content.safetyContentId);
        this.pending = this.pending.filter(c => c.safetyContentId !== content.safetyContentId);
        this.toastr.success('Archived');
      },
      error: () => this.toastr.error('Failed to archive')
    });
  }

  pendingCount(): number {
    return this.pending.length;
  }

  compliance(id: string): AcknowledgmentStatus | null {
    return this.complianceMap.get(id) ?? null;
  }

  completionPct(status: AcknowledgmentStatus): number {
    return Math.round(status.completionRate * 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
