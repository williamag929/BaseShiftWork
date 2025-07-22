import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Area } from 'src/app/core/models/area.model';
import { AreaService } from 'src/app/core/services/area.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { LocationService } from 'src/app/core/services/location.service';
import { Location } from 'src/app/core/models/location.model';

@Component({
  selector: 'app-areas',
  templateUrl: './areas.component.html',
  styleUrls: ['./areas.component.css'],
  standalone: false
})
export class AreasComponent implements OnInit {

  areas: Area[] = [];
  activeCompany$: Observable<any>;
  activeCompany: any;
  selectedArea: Area | null = null;
  locations: Location[] = [];
  areaForm!: FormGroup;
  loading = false;
  error: any = null;

  constructor(
    private areaService: AreaService,
    private authService: AuthService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private locationService: LocationService,
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

    this.activeCompany$.subscribe((company: any) => {
      if (this.activeCompany$) {
        this.loading = true;

        this.locationService.getLocations(company.companyId).subscribe(
          locations => {
            this.locations = locations.filter(a => a.companyId === company.companyId);
            this.loading = false;
          }, error => {
            this.error = error;
            this.loading = false;
          }
        )

        this.loading = true;

        this.areaService.getAreas(company.companyId).subscribe(
          areas => {
            this.areas = areas.filter(a => a.companyId === company.companyId);
            this.loading = false;
          },
          error => {
            this.error = error;
            this.loading = false;
          }
        );
      }
    });

    this.areaForm = this.fb.group({
      name: ['', Validators.required],
      locationId: ['', Validators.required],
      status: ['Active', Validators.required]
    });
  }

  editArea(area: Area): void {
    this.selectedArea = area;
    this.areaForm.patchValue(area);
  }

  getLocationName(locationId: any  | undefined): string {
    return this.locations.find(l => l.locationId === locationId)?.name || 'N/A';
  } 

  cancelEdit(): void {
    this.selectedArea = null;
    this.areaForm.reset({
      name: '',
      locationId: '',
      status: 'Active'
    });
  }

  saveArea(): void {
    if (!this.areaForm.valid) {
      return;
    }

    if (this.selectedArea) {
      const updatedArea: Area = {
        ...this.selectedArea,
        ...this.areaForm.value
      };
      // Note: You will need to implement `updateArea` in your AreaService.
      this.areaService.createArea(this.activeCompany.companyId, updatedArea).subscribe(
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
      const newArea: Area = {
        ...this.areaForm.value,
        companyId: this.activeCompany.companyId
      };
      this.areaService.createArea(newArea.companyId, newArea).subscribe(area => {
        this.areas.push(area);
        this.cancelEdit();
        this.toastr.success('Area created successfully');
      });
    }
  }
}
