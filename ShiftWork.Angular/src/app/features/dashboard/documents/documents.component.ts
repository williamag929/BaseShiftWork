import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { filter, switchMap, takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { DocumentService } from 'src/app/core/services/document.service';
import { Document, UpdateDocumentDto } from 'src/app/core/models/document.model';

@Component({
  selector: 'app-documents',
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.css'],
  standalone: false
})
export class DocumentsComponent implements OnInit, OnDestroy {
  activeCompany$: Observable<any>;
  activeCompany: any;

  documents: Document[] = [];
  loading = false;
  showUpload = false;
  uploading = false;
  searchText = '';
  typeFilter = '';
  selectedFile: File | null = null;

  uploadForm!: FormGroup;

  readonly docTypes = ['Manual', 'Procedure', 'SafetyDataSheet', 'ProductInfo', 'FloorPlan', 'Policy', 'Other'];
  readonly accessLevels = ['Public', 'LocationOnly', 'Restricted'];

  displayedColumns = ['icon', 'title', 'type', 'version', 'accessLevel', 'uploadedBy', 'actions'];

  private destroy$ = new Subject<void>();

  constructor(
    private documentService: DocumentService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private store: Store<AppState>
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.uploadForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      type: ['Other', Validators.required],
      version: ['1.0', Validators.required],
      accessLevel: ['Public', Validators.required],
      locationId: [null]
    });

    this.activeCompany$.pipe(
      filter(c => !!c),
      switchMap(company => {
        this.activeCompany = company;
        return this.loadDocs();
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  loadDocs(): Observable<Document[]> {
    this.loading = true;
    const obs = this.documentService.getDocuments(
      this.activeCompany.companyId,
      undefined,
      this.typeFilter || undefined,
      this.searchText || undefined
    );
    obs.subscribe({
      next: docs => { this.documents = docs; this.loading = false; },
      error: () => { this.toastr.error('Failed to load documents'); this.loading = false; }
    });
    return obs;
  }

  onSearch(): void {
    this.loadDocs();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  async startUpload(): Promise<void> {
    if (this.uploadForm.invalid || !this.selectedFile) {
      this.toastr.warning('Please fill in all required fields and select a file.');
      return;
    }

    this.uploading = true;
    const file = this.selectedFile;
    const formVal = this.uploadForm.value;

    this.documentService.initiateUpload(this.activeCompany.companyId, {
      ...formVal,
      mimeType: file.type,
      fileSize: file.size
    }).subscribe({
      next: ({ documentId, presignedUploadUrl }) => {
        this.documentService.uploadToS3(presignedUploadUrl, file).subscribe({
          next: () => {
            this.documentService.confirmUpload(this.activeCompany.companyId, documentId).subscribe({
              next: doc => {
                this.documents.unshift(doc);
                this.showUpload = false;
                this.selectedFile = null;
                this.uploadForm.reset({ type: 'Other', version: '1.0', accessLevel: 'Public' });
                this.uploading = false;
                this.toastr.success('Document uploaded');
              },
              error: () => { this.uploading = false; this.toastr.error('Upload confirmation failed'); }
            });
          },
          error: () => { this.uploading = false; this.toastr.error('S3 upload failed'); }
        });
      },
      error: () => { this.uploading = false; this.toastr.error('Failed to initiate upload'); }
    });
  }

  openDocument(doc: Document): void {
    this.documentService.getDocument(this.activeCompany.companyId, doc.documentId).subscribe({
      next: detail => {
        if (detail.presignedUrl) {
          window.open(detail.presignedUrl, '_blank');
        }
      },
      error: () => this.toastr.error('Could not open document')
    });
  }

  archive(doc: Document, event: Event): void {
    event.stopPropagation();
    this.documentService.archiveDocument(this.activeCompany.companyId, doc.documentId).subscribe({
      next: () => {
        this.documents = this.documents.filter(d => d.documentId !== doc.documentId);
        this.toastr.success('Document archived');
      },
      error: () => this.toastr.error('Failed to archive')
    });
  }

  docIcon(type: string): string {
    switch (type) {
      case 'SafetyDataSheet': return 'warning';
      case 'FloorPlan':       return 'map';
      case 'Manual':          return 'menu_book';
      case 'Policy':          return 'policy';
      default:                return 'insert_drive_file';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
