/**
 * Sample Unit Tests for Audit History Components
 * 
 * This file provides examples of how to test the audit history components.
 * Copy and adapt these tests to your test files.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { AuditHistoryTimelineComponent } from './audit-history-timeline.component';
import { AuditHistoryFiltersComponent } from './audit-history-filters.component';
import { AuditHistoryDialogComponent } from './audit-history-dialog.component';
import { AuditHistoryButtonComponent } from './audit-history-button.component';
import { AuditHistoryService } from '../../../core/services/audit-history.service';
import {
  AuditHistoryDto,
  AuditHistoryPagedResult,
  AuditActionType
} from '../../../core/models/audit-history.model';

describe('AuditHistoryTimelineComponent', () => {
  let component: AuditHistoryTimelineComponent;
  let fixture: ComponentFixture<AuditHistoryTimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditHistoryTimelineComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AuditHistoryTimelineComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display "No audit history available" when items are empty', () => {
    component.items = [];
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.no-data')).toBeTruthy();
  });

  it('should render timeline items correctly', () => {
    const mockItems: AuditHistoryDto[] = [
      {
        id: '1',
        entityName: 'Person',
        entityId: '123',
        actionType: 'Updated',
        actionDate: new Date(),
        userId: 'user-1',
        userName: 'John Doe',
        fieldName: 'Email',
        oldValue: 'old@example.com',
        newValue: 'new@example.com'
      }
    ];

    component.items = mockItems;
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.timeline-item')).toBeTruthy();
  });

  it('should format action types correctly', () => {
    expect(component.formatActionType('Created')).toBe('Created');
    expect(component.formatActionType('updated')).toBe('Updated');
  });

  it('should return correct action icons', () => {
    expect(component.getActionIcon(AuditActionType.Created)).toBe('add_circle');
    expect(component.getActionIcon(AuditActionType.Updated)).toBe('edit');
    expect(component.getActionIcon(AuditActionType.Deleted)).toBe('delete');
  });

  it('should truncate long values', () => {
    const longValue = 'a'.repeat(150);
    const truncated = component.truncateValue(longValue);
    expect(truncated.length).toBeLessThan(longValue.length);
    expect(truncated).toContain('...');
  });

  it('should handle null/undefined values', () => {
    expect(component.truncateValue(null)).toBe('(empty)');
    expect(component.truncateValue(undefined)).toBe('(empty)');
  });
});

describe('AuditHistoryFiltersComponent', () => {
  let component: AuditHistoryFiltersComponent;
  let fixture: ComponentFixture<AuditHistoryFiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditHistoryFiltersComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AuditHistoryFiltersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default 30-day range', () => {
    const startDate = component.filterForm.get('startDate')?.value;
    const endDate = component.filterForm.get('endDate')?.value;

    expect(startDate).toBeTruthy();
    expect(endDate).toBeTruthy();
    expect(endDate.getTime() - startDate.getTime()).toBeCloseTo(30 * 24 * 60 * 60 * 1000, -5);
  });

  it('should emit filters when applied', (done) => {
    component.filterForm.patchValue({
      actionType: 'Created',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    });

    component.filtersApplied.subscribe(filters => {
      expect(filters.actionType).toBe('Created');
      expect(filters.startDate).toBeTruthy();
      done();
    });

    component.onApplyFilters();
  });

  it('should reset filters to default', () => {
    component.filterForm.patchValue({
      actionType: 'Created',
      entityType: 'Person'
    });

    component.onResetFilters();

    expect(component.filterForm.get('actionType')?.value).toBe('');
    expect(component.filterForm.get('entityType')?.value).toBe('');
  });

  it('should correctly detect active filters', () => {
    component.filterForm.patchValue({ actionType: '' });
    expect(component.hasActiveFilters()).toBeFalse();

    component.filterForm.patchValue({ actionType: 'Created' });
    expect(component.hasActiveFilters()).toBeTrue();
  });
});

describe('AuditHistoryDialogComponent', () => {
  let component: AuditHistoryDialogComponent;
  let fixture: ComponentFixture<AuditHistoryDialogComponent>;
  let auditService: jasmine.SpyObj<AuditHistoryService>;
  let httpMock: HttpTestingController;

  const mockData = {
    entityName: 'Person',
    entityId: '123',
    entityDisplayName: 'John Smith',
    companyId: 'company-1'
  };

  const mockAuditResult: AuditHistoryPagedResult = {
    items: [
      {
        id: '1',
        entityName: 'Person',
        entityId: '123',
        actionType: 'Updated',
        actionDate: new Date(),
        userId: 'user-1',
        userName: 'Admin User',
        fieldName: 'PhoneNumber',
        oldValue: '(555) 123-4567',
        newValue: '(555) 987-6543'
      }
    ],
    totalCount: 1,
    pageNumber: 1,
    pageSize: 20,
    totalPages: 1
  };

  beforeEach(async () => {
    const auditServiceSpy = jasmine.createSpyObj('AuditHistoryService', [
      'getAuditHistoryForEntity',
      'getRelatedAuditHistory',
      'getAuditSummary',
      'getFieldHistory'
    ]);

    await TestBed.configureTestingModule({
      imports: [
        AuditHistoryDialogComponent,
        HttpClientTestingModule,
        MatDialogModule
      ],
      providers: [
        { provide: AuditHistoryService, useValue: auditServiceSpy },
        { provide: 'MAT_DIALOG_DATA', useValue: mockData }
      ]
    }).compileComponents();

    auditService = TestBed.inject(AuditHistoryService) as jasmine.SpyObj<AuditHistoryService>;
    httpMock = TestBed.inject(HttpTestingController);

    auditService.getAuditHistoryForEntity.and.returnValue(of(mockAuditResult));
    auditService.getRelatedAuditHistory.and.returnValue(of([]));

    fixture = TestBed.createComponent(AuditHistoryDialogComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load audit history on init', () => {
    fixture.detectChanges();

    expect(auditService.getAuditHistoryForEntity).toHaveBeenCalled();
    expect(component.auditHistory.length).toBe(1);
  });

  it('should count action types correctly', () => {
    component.allAuditHistory = [
      {
        id: '1',
        entityName: 'Person',
        entityId: '123',
        actionType: 'Created',
        actionDate: new Date(),
        userId: 'user-1'
      },
      {
        id: '2',
        entityName: 'Person',
        entityId: '123',
        actionType: 'Updated',
        actionDate: new Date(),
        userId: 'user-1'
      },
      {
        id: '3',
        entityName: 'Person',
        entityId: '123',
        actionType: 'Updated',
        actionDate: new Date(),
        userId: 'user-1'
      }
    ];

    expect(component.countActionType('Created')).toBe(1);
    expect(component.countActionType('Updated')).toBe(2);
  });

  it('should get unique fields', () => {
    component.allAuditHistory = [
      {
        id: '1',
        entityName: 'Person',
        entityId: '123',
        actionType: 'Updated',
        actionDate: new Date(),
        userId: 'user-1',
        fieldName: 'Email'
      },
      {
        id: '2',
        entityName: 'Person',
        entityId: '123',
        actionType: 'Updated',
        actionDate: new Date(),
        userId: 'user-1',
        fieldName: 'Phone'
      },
      {
        id: '3',
        entityName: 'Person',
        entityId: '123',
        actionType: 'Updated',
        actionDate: new Date(),
        userId: 'user-1',
        fieldName: 'Email'
      }
    ];

    const fields = component.getUniqueFields();
    expect(fields.length).toBe(2);
    expect(fields).toContain('Email');
    expect(fields).toContain('Phone');
  });
});

describe('AuditHistoryButtonComponent', () => {
  let component: AuditHistoryButtonComponent;
  let fixture: ComponentFixture<AuditHistoryButtonComponent>;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    const dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [AuditHistoryButtonComponent],
      providers: [{ provide: MatDialog, useValue: dialogSpy }]
    }).compileComponents();

    dialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;
    fixture = TestBed.createComponent(AuditHistoryButtonComponent);
    component = fixture.componentInstance;

    // Set required inputs
    component.entityId = '123';
    component.entityType = 'Person';
    component.entityDisplayName = 'John Smith';
    component.companyId = 'company-1';
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open audit history dialog when clicked', () => {
    component.openAuditHistory();

    expect(dialog.open).toHaveBeenCalled();
    const callArgs = dialog.open.calls.mostRecent().args;
    expect(callArgs[1]?.data?.entityId).toBe('123');
    expect(callArgs[1]?.data?.entityType).toBeUndefined(); // entityName is used, not entityType
    expect(callArgs[1]?.data?.entityDisplayName).toBe('John Smith');
  });

  it('should render button with correct attributes', () => {
    component.entityType = 'Person';
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    expect(button).toBeTruthy();
    expect(button.getAttribute('mattooltip')).toContain('Person');
  });
});

describe('AuditHistoryService', () => {
  let service: AuditHistoryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuditHistoryService]
    });

    service = TestBed.inject(AuditHistoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch audit history for entity', () => {
    const mockResult: AuditHistoryPagedResult = {
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 20,
      totalPages: 0
    };

    service
      .getAuditHistoryForEntity({
        companyId: 'company-1',
        entityName: 'Person',
        entityId: '123',
        page: 1,
        pageSize: 20
      })
      .subscribe(result => {
        expect(result).toEqual(mockResult);
      });

    const req = httpMock.expectOne(req =>
      req.url.includes('/api/companies/company-1/audit-history/Person/123')
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResult);
  });

  it('should include query parameters in request', () => {
    service
      .getAuditHistoryForEntity({
        companyId: 'company-1',
        entityName: 'Person',
        entityId: '123',
        actionType: 'Updated',
        page: 1,
        pageSize: 20
      })
      .subscribe();

    const req = httpMock.expectOne(req =>
      req.url.includes('actionType=Updated') && req.url.includes('pageSize=20')
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
