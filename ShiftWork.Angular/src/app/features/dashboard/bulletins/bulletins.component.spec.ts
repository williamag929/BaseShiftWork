import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { BulletinsComponent } from './bulletins.component';
import { BulletinService } from 'src/app/core/services/bulletin.service';
import { LocationService } from 'src/app/core/services/location.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { PagedResult } from 'src/app/core/models/paged-result.model';
import { Bulletin } from 'src/app/core/models/bulletin.model';
import { SharedModule } from 'src/app/shared/shared.module';

const MOCK_COMPANY = { companyId: 'co-test', name: 'Test Co' };

function pagedResult(items: Bulletin[]): PagedResult<Bulletin> {
  return { items, totalCount: items.length, page: 1, pageSize: 25 };
}

describe('BulletinsComponent', () => {
  let component: BulletinsComponent;
  let fixture: ComponentFixture<BulletinsComponent>;
  let store: MockStore;
  let bulletinSvc: jasmine.SpyObj<BulletinService>;
  let permSvc: jasmine.SpyObj<PermissionService>;

  beforeEach(async () => {
    bulletinSvc = jasmine.createSpyObj('BulletinService', ['getBulletins', 'markAsRead', 'createBulletin', 'archiveBulletin']);
    permSvc = jasmine.createSpyObj('PermissionService', ['hasPermission']);
    permSvc.hasPermission.and.returnValue(true);

    bulletinSvc.getBulletins.and.returnValue(of(pagedResult([])));

    await TestBed.configureTestingModule({
      declarations: [BulletinsComponent],
      imports: [ReactiveFormsModule, NoopAnimationsModule, SharedModule],
      providers: [
        provideMockStore({ initialState: {} }),
        { provide: BulletinService, useValue: bulletinSvc },
        { provide: LocationService, useValue: { getLocations: () => of([]) } },
        { provide: PermissionService, useValue: permSvc },
        { provide: ToastrService, useValue: { success: () => {}, error: () => {} } }
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectActiveCompany, MOCK_COMPANY);

    fixture = TestBed.createComponent(BulletinsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sets loading=false and populates bulletins after successful load', () => {
    const mockBulletins: Bulletin[] = [
      { bulletinId: 'b1', title: 'Test', content: 'Body', type: 'General', priority: 'Normal', status: 'Published', isReadByCurrentUser: false, totalReads: 0, createdAt: new Date(), createdByName: '' }
    ];
    bulletinSvc.getBulletins.and.returnValue(of(pagedResult(mockBulletins)));

    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.bulletins.length).toBe(1);
    expect(component.errorMessage).toBeNull();
  });

  it('sets errorMessage on load failure', () => {
    bulletinSvc.getBulletins.and.returnValue(throwError(() => new Error('Network error')));

    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBeTruthy();
  });

  it('retry() clears error and reloads', () => {
    bulletinSvc.getBulletins.and.returnValue(throwError(() => new Error('fail')));
    fixture.detectChanges();
    expect(component.errorMessage).toBeTruthy();

    bulletinSvc.getBulletins.and.returnValue(of(pagedResult([])));
    component.retry();

    expect(component.errorMessage).toBeNull();
  });

  it('canCreate reflects permission service', () => {
    permSvc.hasPermission.and.callFake(key => key === 'bulletins.create');
    expect(component.canCreate).toBeTrue();
    expect(component.canArchive).toBeFalse();
  });

  it('unreadCount returns count of unread published bulletins', () => {
    component.bulletins = [
      { bulletinId: 'b1', title: 'A', content: '', type: 'General', priority: 'Normal', status: 'Published', isReadByCurrentUser: false, totalReads: 0, createdAt: new Date(), createdByName: '' },
      { bulletinId: 'b2', title: 'B', content: '', type: 'General', priority: 'Normal', status: 'Published', isReadByCurrentUser: true, totalReads: 1, createdAt: new Date(), createdByName: '' }
    ];

    expect(component.unreadCount()).toBe(1);
  });
});
