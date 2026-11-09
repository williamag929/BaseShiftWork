import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CostCode } from 'src/app/core/models/cost-code.model';
import { CostCodeService } from 'src/app/core/services/cost-code.service';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { LocationService } from 'src/app/core/services/location.service';
import { Location } from 'src/app/core/models/location.model';
import { paginate } from 'src/app/shared/ui';

@Component({
  selector: 'app-cost-codes',
  templateUrl: './cost-codes.component.html',
  standalone: false
})
export class CostCodesComponent implements OnInit, OnDestroy {

  costCodes: CostCode[] = [];
  activeCompany$: Observable<any>;
  activeCompany: any;
  selectedCostCode: CostCode | null = null;
  locations: Location[] = [];
  costCodeForm!: FormGroup;
  loading = false;
  error: any = null;
  saving = false;
  panelOpen = false;
  openerEl: HTMLElement | null = null;
  page = 1;
  pageSize = 25;
  readonly paginate = paginate;
  readonly codeRequired = $localize`:@@cost_codes.code_error:Code is required`;
  readonly nameRequired = $localize`:@@cost_codes.name_error:Name is required`;
  readonly addLabel = $localize`:@@cost_codes.add_btn:Add cost code`;
  readonly allLocationsLabel = $localize`:@@cost_codes.all_locations:All locations`;
  private destroy$ = new Subject<void>();

  constructor(
    private costCodeService: CostCodeService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private locationService: LocationService,
    private store: Store<AppState>
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);

    this.activeCompany$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
      }
    });
  }

  ngOnInit(): void {
    this.activeCompany$.pipe(
      takeUntil(this.destroy$),
      tap(() => {
        this.loading = true;
        this.error = null;
      }),
      switchMap(company => {
        if (!company) {
          this.loading = false;
          return of({ locations: [], costCodes: [] });
        }
        return forkJoin({
          locations: this.locationService.getLocations(company.companyId),
          costCodes: this.costCodeService.getCostCodes(company.companyId)
        }).pipe(
          map(({ locations, costCodes }) => ({
            locations: locations.filter(l => l.companyId === company.companyId),
            costCodes: costCodes.filter(c => c.companyId === company.companyId)
          })),
          catchError(error => {
            this.error = error;
            this.loading = false;
            return of({ locations: [], costCodes: [] });
          })
        );
      })
    ).subscribe(({ locations, costCodes }) => {
      this.locations = locations;
      this.costCodes = costCodes;
      this.loading = false;
      this.page = Math.min(this.page, Math.max(1, Math.ceil(costCodes.length / this.pageSize)));
    });

    this.costCodeForm = this.fb.group({
      code: ['', Validators.required],
      name: ['', Validators.required],
      description: [''],
      locationId: [''],
      externalCode: [''],
      status: ['Active', Validators.required]
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  addCostCode(): void {
    this.cancelEdit();
    this.panelOpen = true;
  }

  editLabel(costCode: CostCode): string {
    return $localize`:@@cost_codes.edit_aria:Edit ${costCode.code}:code:`;
  }

  editCostCode(costCode: CostCode): void {
    this.panelOpen = true;
    this.selectedCostCode = costCode;
    this.costCodeForm.patchValue({
      code: costCode.code,
      name: costCode.name,
      description: costCode.description ?? '',
      locationId: costCode.locationId ?? '',
      externalCode: costCode.externalCode ?? '',
      status: costCode.status ?? 'Active'
    });
    this.costCodeForm.markAsPristine();
  }

  getLocationName(locationId: string | number | undefined | null): string {
    if (locationId === null || locationId === undefined || locationId === '') {
      return this.allLocationsLabel;
    }
    const numericLocationId = typeof locationId === 'string' ? parseInt(locationId, 10) : locationId;
    if (isNaN(numericLocationId)) {
      return this.allLocationsLabel;
    }
    const location = this.locations.find(l => l.locationId === numericLocationId);
    return location?.name || this.allLocationsLabel;
  }

  cancelEdit(): void {
    this.panelOpen = false;
    this.selectedCostCode = null;
    this.costCodeForm.reset({
      code: '',
      name: '',
      description: '',
      locationId: '',
      externalCode: '',
      status: 'Active'
    });
  }

  private normalize(value: any): CostCode {
    const raw = this.costCodeForm.value;
    return {
      ...value,
      ...raw,
      locationId: raw.locationId === '' || raw.locationId === null ? null : Number(raw.locationId),
      externalCode: raw.externalCode === '' ? null : raw.externalCode
    };
  }

  saveCostCode(): void {
    if (!this.costCodeForm.valid || this.saving) {
      return;
    }
    this.saving = true;

    if (this.selectedCostCode) {
      const updated = this.normalize(this.selectedCostCode);
      this.costCodeService.updateCostCode(this.activeCompany.companyId, updated.costCodeId, updated).subscribe(
        (result) => {
          const index = this.costCodes.findIndex(c => c.costCodeId === result.costCodeId);
          if (index > -1) {
            this.costCodes[index] = result;
          }
          this.saving = false;
          this.toastr.success($localize`:@@cost_codes.toast_updated:Cost code updated.`);
          this.cancelEdit();
        },
        () => {
          this.saving = false;
          this.toastr.error($localize`:@@cost_codes.toast_update_failed:Could not update the cost code.`);
        }
      );
    } else {
      const newCostCode = this.normalize({
        costCodeId: 0,
        companyId: this.activeCompany.companyId
      });
      this.costCodeService.createCostCode(newCostCode.companyId, newCostCode).subscribe(
        (costCode) => {
          this.saving = false;
          this.costCodes.push(costCode);
          this.cancelEdit();
          this.toastr.success($localize`:@@cost_codes.toast_created:Cost code created.`);
        },
        () => {
          this.saving = false;
          this.toastr.error($localize`:@@cost_codes.toast_create_failed:Could not create the cost code.`);
        }
      );
    }
  }
}
