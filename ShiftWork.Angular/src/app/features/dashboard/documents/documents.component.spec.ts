import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { DocumentsComponent } from './documents.component';
import { DocumentService } from 'src/app/core/services/document.service';
import { LocationService } from 'src/app/core/services/location.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { PagedResult } from 'src/app/core/models/paged-result.model';
import { Document } from 'src/app/core/models/document.model';
import { Company } from 'src/app/core/models/company.model';
import { SharedModule } from 'src/app/shared/shared.module';

const MOCK_COMPANY: Company = {
  companyId: 'co-test', name: 'Test Co', address: '1 Main St',
  phoneNumber: '555-0000', email: 'test@test.com', website: 'https://test.com', timeZone: 'UTC'
};

function pagedResult<T>(items: T[]): PagedResult<T> {
  return { items, totalCount: items.length, page: 1, pageSize: 25 };
}

const MOCK_DOC: Document = {
  documentId: 'd1', companyId: 'co-test', title: 'Safety Manual', type: 'Manual',
  mimeType: 'application/pdf', fileSize: 2048, version: '1.0',
  accessLevel: 'Public', status: 'Active', uploadedByName: 'Admin',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
};

describe('DocumentsComponent', () => {
  let component: DocumentsComponent;
  let fixture: ComponentFixture<DocumentsComponent>;
  let store: MockStore;
  let docSvc: jasmine.SpyObj<DocumentService>;
  let permSvc: jasmine.SpyObj<PermissionService>;

  beforeEach(async () => {
    docSvc = jasmine.createSpyObj('DocumentService', [
      'getDocuments', 'initiateUpload', 'confirmUpload', 'uploadToS3', 'archiveDocument', 'getDocument'
    ]);
    permSvc = jasmine.createSpyObj('PermissionService', ['hasPermission']);
    permSvc.hasPermission.and.returnValue(true);

    docSvc.getDocuments.and.returnValue(of(pagedResult([])));

    await TestBed.configureTestingModule({
      declarations: [DocumentsComponent],
      imports: [ReactiveFormsModule, NoopAnimationsModule, SharedModule],
      providers: [
        provideMockStore({ initialState: {} }),
        { provide: DocumentService, useValue: docSvc },
        { provide: LocationService, useValue: { getLocations: () => of([]) } },
        { provide: PermissionService, useValue: permSvc },
        { provide: ToastrService, useValue: { success: () => {}, error: () => {}, warning: () => {} } }
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectActiveCompany, MOCK_COMPANY);

    fixture = TestBed.createComponent(DocumentsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('populates documents and clears loading after successful load', () => {
    docSvc.getDocuments.and.returnValue(of(pagedResult([MOCK_DOC])));

    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.documents.length).toBe(1);
    expect(component.totalCount).toBe(1);
    expect(component.errorMessage).toBeNull();
  });

  it('sets errorMessage on load failure', () => {
    docSvc.getDocuments.and.returnValue(throwError(() => new Error('Network error')));

    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBeTruthy();
  });

  it('retry() clears error and reloads', () => {
    docSvc.getDocuments.and.returnValue(throwError(() => new Error('fail')));
    fixture.detectChanges();
    expect(component.errorMessage).toBeTruthy();

    docSvc.getDocuments.and.returnValue(of(pagedResult([])));
    component.retry();

    expect(component.errorMessage).toBeNull();
  });

  it('onSearch() resets page to 1 before reloading', () => {
    fixture.detectChanges();
    component.page = 4;
    component.onSearch();

    expect(component.page).toBe(1);
    expect(docSvc.getDocuments).toHaveBeenCalled();
  });

  it('onPageChange() updates page and pageSize then reloads', () => {
    fixture.detectChanges();
    component.onPageChange({ pageIndex: 2, pageSize: 10 });

    expect(component.page).toBe(3);
    expect(component.pageSize).toBe(10);
    expect(docSvc.getDocuments).toHaveBeenCalled();
  });

  it('canUpload and canArchive reflect permission service', () => {
    permSvc.hasPermission.and.callFake(key => key === 'documents.upload');
    expect(component.canUpload).toBeTrue();
    expect(component.canArchive).toBeFalse();
  });

  it('docIcon returns correct icon for known document types', () => {
    expect(component.docIcon('SafetyDataSheet')).toBe('warning');
    expect(component.docIcon('FloorPlan')).toBe('map');
    expect(component.docIcon('Manual')).toBe('menu_book');
    expect(component.docIcon('Policy')).toBe('policy');
    expect(component.docIcon('Other')).toBe('insert_drive_file');
  });
});
