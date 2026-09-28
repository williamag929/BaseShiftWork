import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Area } from 'src/app/core/models/area.model';
import { AreaService } from 'src/app/core/services/area.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { LocationService } from 'src/app/core/services/location.service';
import { Location } from 'src/app/core/models/location.model';
import { CostCodeService } from 'src/app/core/services/cost-code.service';
import { CostCode } from 'src/app/core/models/cost-code.model';

@Component({
  selector: 'app-areas',
  templateUrl: './areas.component.html',
  styleUrls: ['./areas.component.css'],
  standalone: false
})
export class AreasComponent implements OnInit, OnDestroy {

  areas: Area[] = [];
  activeCompany$: Observable<any>;
  activeCompany: any;
  selectedArea: Area | null = null;
  locations: Location[] = [];
  costCodes: CostCode[] = [];
  areaForm!: FormGroup;
  loading = false;
  error: any = null;
  private destroy$ = new Subject<void>();

  constructor(
    private areaService: AreaService,
    private authService: AuthService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private locationService: LocationService,
    private costCodeService: CostCodeService,
    private store: Store<AppState>
  ) {

    this.activeCompany$ = this.store.select(selectActiveCompany);

    this.activeCompany$.subscribe((company: any) => {
      if (company) {
        this.activeCompany = company;
        console.log('Active company set:', this.activeCompany);
      } else {
        console.log('No active company found');
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
          return of({ locations: [], areas: [], costCodes: [] });
        }
        return forkJoin({
          locations: this.locationService.getLocations(company.companyId),
          areas: this.areaService.getAreas(company.companyId),
          costCodes: this.costCodeService.getCostCodes(company.companyId)
        }).pipe(
          map(({ locations, areas, costCodes }) => ({
            locations: locations.filter(l => l.companyId === company.companyId),
            areas: areas.filter(a => a.companyId === company.companyId),
            costCodes: costCodes.filter(c => c.companyId === company.companyId)
          })),
          catchError(error => {
            this.error = error;
            this.loading = false;
            return of({ locations: [], areas: [], costCodes: [] });
          })
        );
      })
    ).subscribe(({ locations, areas, costCodes }) => {
      this.locations = locations;
      this.areas = areas;
      this.costCodes = costCodes;
      this.loading = false;
    });

    this.areaForm = this.fb.group({
      name: ['', Validators.required],
      locationId: ['', Validators.required],
      costCodeId: [''],
      status: ['Active', Validators.required]
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  editArea(area: Area): void {
    this.selectedArea = area;
    this.areaForm.patchValue({ ...area, costCodeId: area.costCodeId ?? '' });
  }

  getCostCodeLabel(costCodeId: number | null | undefined): string | null {
    if (costCodeId === null || costCodeId === undefined) {
      return null;
    }
    const cc = this.costCodes.find(c => c.costCodeId === costCodeId);
    return cc ? `${cc.code} — ${cc.name}` : null;
  }

  getLocationName(locationId: string | number | undefined): string {
    if (locationId === null || locationId === undefined || locationId === '') {
      return 'N/A';
    }
    // The locationId from an Area can be a string, but in the Location model it's a number.
    // We need to ensure we are comparing numbers.
    const numericLocationId = typeof locationId === 'string' ? parseInt(locationId, 10) : locationId;
    if (isNaN(numericLocationId)) {
      return 'N/A';
    }
    const location = this.locations.find(l => l.locationId === numericLocationId);
    return location?.name || 'N/A';
  }

  cancelEdit(): void {
    this.selectedArea = null;
    this.areaForm.reset({
      name: '',
      locationId: '',
      costCodeId: '',
      status: 'Active'
    });
  }

  private withCostCode<T extends Area>(area: T): T {
    const raw = this.areaForm.value.costCodeId;
    area.costCodeId = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    return area;
  }

  saveArea(): void {
    if (!this.areaForm.valid) {
      return;
    }

    if (this.selectedArea) {
      const updatedArea: Area = this.withCostCode({
        ...this.selectedArea,
        ...this.areaForm.value
      });
      this.areaService.updateArea(this.activeCompany.companyId, updatedArea.areaId, updatedArea).subscribe(
        (result) => {
          const index = this.areas.findIndex(a => a.areaId === result.areaId);
          if (index > -1) {
            this.areas[index] = result;
          }
          this.toastr.success('Area updated successfully.');
          this.cancelEdit();
        },
        () => this.toastr.error('Failed to update area.')
      );
    } else {
      const newArea: Area = this.withCostCode({
        areaId: 0, // Provide a temporary ID, the backend will assign the real one.
        ...this.areaForm.value,
        companyId: this.activeCompany.companyId
      });
      this.areaService.createArea(newArea.companyId, newArea).subscribe(area => {
        this.areas.push(area);
        this.cancelEdit();
        this.toastr.success('Area created successfully.');
      },
      () => this.toastr.error('Failed to create area.')
      );
    }
  }
}
