import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

import { CompanyFormComponent } from './company-form.component';
import { CompanyService } from 'src/app/core/services/company.service';

describe('CompanyFormComponent', () => {
  let component: CompanyFormComponent;
  let fixture: ComponentFixture<CompanyFormComponent>;

  beforeEach(async () => {
    const companyServiceStub = {
      getCompany: () => of({}),
      updateCompany: () => of({}),
      createCompany: () => of({})
    };
    const activatedRouteStub = { snapshot: { paramMap: { get: () => null } } };
    const routerStub = { navigate: jasmine.createSpy('navigate') };
    const toastrStub = { success: jasmine.createSpy('success') };

    await TestBed.configureTestingModule({
      declarations: [CompanyFormComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: CompanyService, useValue: companyServiceStub },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: Router, useValue: routerStub },
        { provide: ToastrService, useValue: toastrStub }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompanyFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
