import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { SafetyComponent } from './safety.component';
import { SafetyService } from 'src/app/core/services/safety.service';
import { LocationService } from 'src/app/core/services/location.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { PagedResult } from 'src/app/core/models/paged-result.model';
import { SafetyContent } from 'src/app/core/models/safety.model';
import { Company } from 'src/app/core/models/company.model';
import { SharedModule } from 'src/app/shared/shared.module';

const MOCK_COMPANY: Company = {
  companyId: 'co-test', name: 'Test Co', address: '1 Main St',
  phoneNumber: '555-0000', email: 'test@test.com', website: 'https://test.com', timeZone: 'UTC'
};

function pagedResult(items: SafetyContent[]): PagedResult<SafetyContent> {
  return { items, totalCount: items.length, page: 1, pageSize: 25 };
}

describe('SafetyComponent', () => {
  let component: SafetyComponent;
  let fixture: ComponentFixture<SafetyComponent>;
  let store: MockStore;
  let safetySvc: jasmine.SpyObj<SafetyService>;
  let permSvc: jasmine.SpyObj<PermissionService>;

  beforeEach(async () => {
    safetySvc = jasmine.createSpyObj('SafetyService', ['getContents', 'acknowledge', 'createContent', 'archiveContent', 'getAcknowledgmentStatus']);
    permSvc = jasmine.createSpyObj('PermissionService', ['hasPermission']);
    permSvc.hasPermission.and.returnValue(true);

    safetySvc.getContents.and.returnValue(of(pagedResult([])));

    await TestBed.configureTestingModule({
      declarations: [SafetyComponent],
      imports: [ReactiveFormsModule, NoopAnimationsModule, SharedModule],
      providers: [
        provideMockStore({ initialState: {} }),
        { provide: SafetyService, useValue: safetySvc },
        { provide: LocationService, useValue: { getLocations: () => of([]) } },
        { provide: PermissionService, useValue: permSvc },
        { provide: ToastrService, useValue: { success: () => {}, error: () => {} } }
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectActiveCompany, MOCK_COMPANY);

    fixture = TestBed.createComponent(SafetyComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('populates contents and pending after load', () => {
    const pending: SafetyContent = {
      safetyContentId: 's1', companyId: 'co-test', title: 'Toolbox Talk', description: 'Weekly talk',
      type: 'ToolboxTalk', status: 'Published',
      isAcknowledgmentRequired: true, isAcknowledgedByCurrentUser: false,
      createdAt: '2026-01-01T00:00:00Z', createdByName: ''
    };
    safetySvc.getContents.and.returnValue(of(pagedResult([pending])));

    fixture.detectChanges();

    expect(component.contents.length).toBe(1);
    expect(component.pending.length).toBe(1);
    expect(component.errorMessage).toBeNull();
  });

  it('acknowledged content does not appear in pending', () => {
    const acked: SafetyContent = {
      safetyContentId: 's2', companyId: 'co-test', title: 'Done', description: 'Orientation session',
      type: 'Orientation', status: 'Published',
      isAcknowledgmentRequired: true, isAcknowledgedByCurrentUser: true,
      createdAt: '2026-01-01T00:00:00Z', createdByName: ''
    };
    safetySvc.getContents.and.returnValue(of(pagedResult([acked])));

    fixture.detectChanges();

    expect(component.contents.length).toBe(1);
    expect(component.pending.length).toBe(0);
  });

  it('sets errorMessage on load failure', () => {
    safetySvc.getContents.and.returnValue(throwError(() => new Error('fail')));

    fixture.detectChanges();

    expect(component.errorMessage).toBeTruthy();
    expect(component.loading).toBeFalse();
  });

  it('retry() reloads and clears error', () => {
    safetySvc.getContents.and.returnValue(throwError(() => new Error('fail')));
    fixture.detectChanges();
    expect(component.errorMessage).toBeTruthy();

    safetySvc.getContents.and.returnValue(of(pagedResult([])));
    component.retry();

    expect(component.errorMessage).toBeNull();
  });

  it('canCreate and canArchive reflect permission service', () => {
    permSvc.hasPermission.and.callFake(key => key === 'safety.create');
    expect(component.canCreate).toBeTrue();
    expect(component.canArchive).toBeFalse();
  });
});
