import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, Subject } from 'rxjs';
import { filter, switchMap, takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { CredentialService } from 'src/app/core/services/credential.service';
import { Credential, CredentialExpiryStatus } from 'src/app/core/models/credential.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { People } from 'src/app/core/models/people.model';
import { PermissionService } from 'src/app/core/services/permission.service';

@Component({
  selector: 'app-credentials',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, MatTooltipModule],
  templateUrl: './credentials.component.html',
  styleUrls: ['./credentials.component.css']
})
export class CredentialsComponent implements OnInit, OnDestroy {
  activeCompany$: Observable<any>;
  activeCompany: any;

  credentials: Credential[] = [];
  people: People[] = [];
  loading = false;
  errorMessage: string | null = null;
  showForm = false;
  saving = false;
  selectedFile: File | null = null;
  editing: Credential | null = null;

  personFilter: number | null = null;
  statusFilter: CredentialExpiryStatus | '' = '';

  form!: FormGroup;

  private destroy$ = new Subject<void>();

  get canCreate(): boolean { return this.permissionService.hasPermission('credentials.create'); }
  get canUpdate(): boolean { return this.permissionService.hasPermission('credentials.update'); }
  get canDelete(): boolean { return this.permissionService.hasPermission('credentials.delete'); }

  constructor(
    private credentialService: CredentialService,
    private peopleService: PeopleService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private store: Store<AppState>,
    private permissionService: PermissionService
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      personId: [null, Validators.required],
      name: ['', Validators.required],
      type: [''],
      issuingAuthority: [''],
      credentialNumber: [''],
      issueDate: [''],
      expiryDate: ['', Validators.required],
    });

    this.activeCompany$.pipe(
      filter(c => !!c),
      switchMap(company => {
        this.activeCompany = company;
        this.loadPeople();
        return this.loadCredentials();
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  loadPeople(): void {
    this.peopleService.getPeople(this.activeCompany.companyId, 1, 500).subscribe({
      next: people => { this.people = people; },
      error: () => { this.people = []; }
    });
  }

  loadCredentials(): Observable<Credential[]> {
    this.loading = true;
    this.errorMessage = null;
    const obs = this.credentialService.getCredentials(
      this.activeCompany.companyId,
      this.personFilter ?? undefined
    );
    obs.subscribe({
      next: result => {
        this.credentials = this.statusFilter
          ? result.filter(c => c.expiryStatus === this.statusFilter)
          : result;
        this.loading = false;
      },
      error: () => { this.errorMessage = 'Failed to load credentials. Check your connection and try again.'; this.loading = false; }
    });
    return obs;
  }

  retry(): void {
    this.loadCredentials();
  }

  onFilterChange(): void {
    this.loadCredentials();
  }

  personName(personId: number): string {
    return this.people.find(p => p.personId === personId)?.name ?? `Person #${personId}`;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  startCreate(): void {
    this.editing = null;
    this.selectedFile = null;
    this.form.reset();
    this.showForm = true;
  }

  startEdit(credential: Credential): void {
    this.editing = credential;
    this.selectedFile = null;
    this.form.patchValue({
      personId: credential.personId,
      name: credential.name,
      type: credential.type,
      issuingAuthority: credential.issuingAuthority,
      credentialNumber: credential.credentialNumber,
      issueDate: credential.issueDate ? credential.issueDate.substring(0, 10) : '',
      expiryDate: credential.expiryDate.substring(0, 10),
    });
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.editing = null;
    this.selectedFile = null;
    this.form.reset();
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.toastr.warning('Please fill in all required fields.');
      return;
    }

    this.saving = true;
    const formVal = this.form.value;

    if (this.editing) {
      this.credentialService.updateCredential(this.activeCompany.companyId, this.editing.credentialId, {
        name: formVal.name,
        type: formVal.type || undefined,
        issuingAuthority: formVal.issuingAuthority || undefined,
        credentialNumber: formVal.credentialNumber || undefined,
        issueDate: formVal.issueDate || undefined,
        expiryDate: formVal.expiryDate,
      }).subscribe({
        next: () => {
          this.saving = false;
          this.cancelForm();
          this.loadCredentials();
          this.toastr.success('Credential updated');
        },
        error: () => { this.saving = false; this.toastr.error('Failed to update credential'); }
      });
      return;
    }

    const createDto = {
      personId: formVal.personId,
      name: formVal.name,
      type: formVal.type || undefined,
      issuingAuthority: formVal.issuingAuthority || undefined,
      credentialNumber: formVal.credentialNumber || undefined,
      issueDate: formVal.issueDate || undefined,
      expiryDate: formVal.expiryDate,
    };

    if (this.selectedFile) {
      const file = this.selectedFile;
      this.credentialService.initiateUpload(this.activeCompany.companyId, { ...createDto, mimeType: file.type }).subscribe({
        next: ({ credentialId, presignedUploadUrl }) => {
          this.credentialService.uploadToS3(presignedUploadUrl, file).subscribe({
            next: () => {
              this.credentialService.confirmUpload(this.activeCompany.companyId, credentialId).subscribe({
                next: () => {
                  this.saving = false;
                  this.cancelForm();
                  this.loadCredentials();
                  this.toastr.success('Credential added');
                },
                error: () => { this.saving = false; this.toastr.error('Upload confirmation failed'); }
              });
            },
            error: () => { this.saving = false; this.toastr.error('S3 upload failed'); }
          });
        },
        error: () => { this.saving = false; this.toastr.error('Failed to initiate upload'); }
      });
    } else {
      this.credentialService.createCredential(this.activeCompany.companyId, createDto).subscribe({
        next: () => {
          this.saving = false;
          this.cancelForm();
          this.loadCredentials();
          this.toastr.success('Credential added');
        },
        error: () => { this.saving = false; this.toastr.error('Failed to add credential'); }
      });
    }
  }

  archive(credential: Credential, event: Event): void {
    event.stopPropagation();
    this.credentialService.archiveCredential(this.activeCompany.companyId, credential.credentialId).subscribe({
      next: () => {
        this.credentials = this.credentials.filter(c => c.credentialId !== credential.credentialId);
        this.toastr.success('Credential archived');
      },
      error: () => this.toastr.error('Failed to archive')
    });
  }

  viewDocument(credential: Credential, event: Event): void {
    event.stopPropagation();
    this.credentialService.getCredential(this.activeCompany.companyId, credential.credentialId).subscribe({
      next: detail => {
        if (detail.documentViewUrl) {
          window.open(detail.documentViewUrl, '_blank');
        }
      },
      error: () => this.toastr.error('Could not open document')
    });
  }

  statusLabel(status: CredentialExpiryStatus): string {
    switch (status) {
      case 'Expired': return 'Expired';
      case 'ExpiringSoon': return 'Expiring Soon';
      default: return 'Valid';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
