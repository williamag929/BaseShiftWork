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
import { PagedResult } from 'src/app/core/models/paged-result.model';
import { LocationService } from 'src/app/core/services/location.service';
import { Location } from 'src/app/core/models/location.model';
import { PermissionService } from 'src/app/core/services/permission.service';

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
  errorMessage: string | null = null;
  showUpload = false;
  uploading = false;
  searchText = '';
  typeFilter = '';
  locationFilter: number | null = null;
  selectedFile: File | null = null;
  locations: Location[] = [];

  totalCount = 0;
  page = 1;
  pageSize = 25;

  uploadForm!: FormGroup;

  readonly docTypes = ['Manual', 'Procedure', 'SafetyDataSheet', 'ProductInfo', 'FloorPlan', 'Policy', 'Other'];
  readonly accessLevels = ['Public', 'LocationOnly', 'Restricted'];

  private destroy$ = new Subject<void>();

  get canUpload(): boolean { return this.permissionService.hasPermission('documents.upload'); }
  get canArchive(): boolean { return this.permissionService.hasPermission('documents.archive'); }

  constructor(
    private documentService: DocumentService,
    private locationService: LocationService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private store: Store<AppState>,
    private permissionService: PermissionService
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
        this.loadLocations();
        return this.loadDocs();
      }),
      takeUntil(this.destroy$)
    ).subscribe();

    this.uploadForm.get('accessLevel')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(level => {
      const locationCtrl = this.uploadForm.get('locationId');
      if (!locationCtrl) return;
      if (level === 'LocationOnly') {
        locationCtrl.setValidators([Validators.required]);
      } else {
        locationCtrl.clearValidators();
      }
      locationCtrl.updateValueAndValidity();
    });
  }

  loadLocations(): void {
    this.locationService.getLocations(this.activeCompany.companyId).subscribe({
      next: locations => {
        this.locations = locations.filter(l => l.status?.toLowerCase() !== 'inactive');
      },
      error: () => {
        this.locations = [];
      }
    });
  }

  loadDocs(): Observable<PagedResult<Document>> {
    this.loading = true;
    this.errorMessage = null;
    const obs = this.documentService.getDocuments(
      this.activeCompany.companyId,
      this.locationFilter ?? undefined,
      this.typeFilter || undefined,
      this.searchText || undefined,
      this.page,
      this.pageSize
    );
    obs.subscribe({
      next: result => { this.documents = result.items; this.totalCount = result.totalCount; this.loading = false; },
      error: () => { this.errorMessage = 'Failed to load documents. Check your connection and try again.'; this.loading = false; }
    });
    return obs;
  }

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadDocs();
  }

  retry(): void {
    this.loadDocs();
  }

  locationName(locationId?: number): string {
    if (!locationId) return 'All locations';
    return this.locations.find(l => l.locationId === locationId)?.name ?? `Location #${locationId}`;
  }

  onSearch(): void {
    this.page = 1;
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
