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
  areaForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: ['', Validators.required]
  });
  loading = false;
  error: any = null;

  constructor(
    private areaService: AreaService,
    private authService: AuthService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private store: Store<AppState>
  ) { 
    
    this.activeCompany$ = this.store.select(selectActiveCompany);

    this.activeCompany$.subscribe((company:any) => {
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
      description: ['', Validators.required]
    });
  }

  createArea(): void {
    if (this.areaForm.valid) {
      const newArea: Area = {
        id: null,
        ...this.areaForm.value,
        companyId: this.activeCompany.companyId
      };
      this.areaService.createArea(newArea.companyId, newArea).subscribe(area => {
        this.areas.push(area);
        this.areaForm.reset();
        this.toastr.success('Area created successfully');
      });
    }
  }
}
