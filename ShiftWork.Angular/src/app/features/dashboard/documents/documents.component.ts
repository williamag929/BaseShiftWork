import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { DocumentService } from 'src/app/core/services/document.service';
import { Document, UpdateDocumentDto } from 'src/app/core/models/document.model';
import { LocationService } from 'src/app/core/services/location.service';
import { Location } from 'src/app/core/models/location.model';
import { PermissionService } from 'src/app/core/services/permission.service';

@Component({
  selector: 'app-documents',
  templateUrl: './documents.component.html',
  standalone: false
})
export class DocumentsComponent implements OnInit, OnDestroy {
  activeCompany$: Observable<any>;
  activeCompany: any;

  documents: Document[] = [];
  loading = false;
  errorMessage: string | null = null;
  panelOpen = false;
  openerEl: HTMLElement | null = null;
  documentToArchive: Document | null = null;
  private archiveOpener: HTMLElement | null = null;
  @ViewChild('addBtn') private addBtn?: ElementRef<HTMLElement>;
  @ViewChild('listRegion') private listRegion?: ElementRef<HTMLElement>;
  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;
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

  readonly typeLabels: Record<string, string> = {
    Manual: $localize`:@@documents.type_manual:Manual`,
    Procedure: $localize`:@@documents.type_procedure:Procedure`,
    SafetyDataSheet: $localize`:@@documents.type_sds:Safety data sheet`,
    ProductInfo: $localize`:@@documents.type_product_info:Product info`,
    FloorPlan: $localize`:@@documents.type_floor_plan:Floor plan`,
    Policy: $localize`:@@documents.type_policy:Policy`,
    Other: $localize`:@@documents.type_other:Other`
  };
  readonly accessLabels: Record<string, string> = {
    Public: $localize`:@@documents.access_public:Public`,
    LocationOnly: $localize`:@@documents.access_location_only:Location only`,
    Restricted: $localize`:@@documents.access_restricted:Restricted`
  };
  readonly uploadLabel = $localize`:@@documents.form_heading:Upload document`;
  readonly locationHint = $localize`:@@documents.location_hint:Required for location-only access`;
  readonly titleRequired = $localize`:@@documents.title_error:Title is required`;
  readonly versionRequired = $localize`:@@documents.version_error:Version is required`;
  readonly locationRequired = $localize`:@@documents.location_error:Choose a location for location-only access`;

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
      takeUntil(this.destroy$)
    ).subscribe(company => {
      this.activeCompany = company;
      this.loadLocations();
      this.loadDocs();
    });

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

  loadDocs(): void {
    this.loading = true;
    this.errorMessage = null;
    this.documentService.getDocuments(
      this.activeCompany.companyId,
      this.locationFilter ?? undefined,
      this.typeFilter || undefined,
      this.searchText || undefined,
      this.page,
      this.pageSize
    ).subscribe({
      next: result => {
        this.totalCount = result.totalCount;
        const lastPage = Math.max(1, Math.ceil(result.totalCount / this.pageSize));
        if (this.page > lastPage) {
          this.page = lastPage;
          this.loadDocs();
          return;
        }
        this.documents = result.items;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = $localize`:@@documents.load_error:Could not load documents. Check your connection and try again.`;
        this.loading = false;
      }
    });
  }

  onPageChange(page: number): void {
    this.page = page;
    this.loadDocs();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.loadDocs();
  }

  get hasFilters(): boolean {
    return !!(this.searchText || this.typeFilter || this.locationFilter);
  }

  get locationRequiredNow(): boolean {
    return this.uploadForm.get('accessLevel')?.value === 'LocationOnly';
  }

  openUpload(): void {
    this.cancelUpload();
    this.panelOpen = true;
  }

  cancelUpload(): void {
    this.panelOpen = false;
    if (!this.uploading) {
      if (this.fileInput) this.fileInput.nativeElement.value = '';
      this.selectedFile = null;
      this.uploadForm.reset({ type: 'Other', version: '1.0', accessLevel: 'Public' });
    }
  }

  pickFile(event?: Event): void {
    event?.preventDefault();
    this.fileInput?.nativeElement.click();
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    this.selectedFile = event.dataTransfer?.files?.[0] ?? this.selectedFile;
  }

  retry(): void {
    this.loadDocs();
  }

  locationName(locationId?: number): string {
    if (!locationId) return $localize`:@@documents.form_all_locations:All locations`;
    return this.locations.find(l => l.locationId === locationId)?.name ?? $localize`:@@documents.location_number:Location #${locationId}:id:`;
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
      this.toastr.warning($localize`:@@documents.toast_incomplete:Fill in all required fields and choose a file.`);
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
                this.totalCount++;
                this.uploading = false;
                this.cancelUpload();
                this.toastr.success($localize`:@@documents.toast_uploaded:Document uploaded.`);
              },
              error: () => { this.uploading = false; this.toastr.error($localize`:@@documents.toast_confirm_failed:Could not confirm the upload.`); }
            });
          },
          error: () => { this.uploading = false; this.toastr.error($localize`:@@documents.toast_s3_failed:Could not upload the file.`); }
        });
      },
      error: () => { this.uploading = false; this.toastr.error($localize`:@@documents.toast_initiate_failed:Could not start the upload.`); }
    });
  }

  openDocument(doc: Document): void {
    this.documentService.getDocument(this.activeCompany.companyId, doc.documentId).subscribe({
      next: detail => {
        if (detail.presignedUrl) {
          window.open(detail.presignedUrl, '_blank');
        }
      },
      error: () => this.toastr.error($localize`:@@documents.toast_open_failed:Could not open the document.`)
    });
  }

  askArchive(doc: Document, opener: HTMLElement): void {
    this.archiveOpener = opener;
    this.documentToArchive = doc;
  }

  cancelArchive(): void {
    const opener = this.archiveOpener;
    this.documentToArchive = null;
    this.archiveOpener = null;
    Promise.resolve().then(() => opener?.focus());
  }

  confirmArchive(): void {
    const doc = this.documentToArchive;
    if (!doc) return;
    const opener = this.archiveOpener;
    this.documentToArchive = null;
    this.archiveOpener = null;
    this.documentService.archiveDocument(this.activeCompany.companyId, doc.documentId).subscribe({
      next: () => {
        this.documents = this.documents.filter(d => d.documentId !== doc.documentId);
        this.totalCount = Math.max(0, this.totalCount - 1);
        this.toastr.success($localize`:@@documents.toast_archived:Document archived.`);
        if (this.documents.length === 0 && this.page > 1) {
          this.page--;
          this.loadDocs();
        }
        Promise.resolve().then(() => (this.addBtn ?? this.listRegion)?.nativeElement.focus());
      },
      error: () => {
        this.toastr.error($localize`:@@documents.toast_archive_failed:Could not archive the document.`);
        Promise.resolve().then(() => opener?.focus());
      }
    });
  }

  archiveTitle(): string {
    return $localize`:@@documents.archive_title:Archive ${this.documentToArchive?.title ?? ''}:name:?`;
  }

  archiveLabel(d: Document): string {
    return $localize`:@@documents.archive_aria:Archive ${d.title}:name:`;
  }

  openLabel(d: Document): string {
    return $localize`:@@documents.open_aria:Open ${d.title}:name:`;
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
