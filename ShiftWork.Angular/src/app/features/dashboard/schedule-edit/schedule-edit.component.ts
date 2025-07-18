import { Component, Input, OnInit } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { People } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { Schedule } from 'src/app/core/models/schedule.model';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';

@Component({
  selector: 'app-schedule-edit',
  templateUrl: './schedule-edit.component.html',
  styleUrls: ['./schedule-edit.component.css'],
  imports: [ ReactiveFormsModule,CommonModule,SharedModule ],
  standalone: true
})
export class ScheduleEditComponent implements OnInit {
  @Input() schedule: Schedule = {} as Schedule;
  scheduleForm!: FormGroup;
  people: People[] = [];

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private peopleService: PeopleService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.authService.activeCompany$.subscribe((company: { id: string }) => {
      if (company) {
        this.peopleService.getPeople(company.id).subscribe(people => {
          this.people = people.filter(p => p.companyId === company.id);
        });
      }
    });

    this.scheduleForm = this.fb.group({
      personId: [this.schedule?.personId, Validators.required],
      startTime: [this.schedule?.startTime, Validators.required],
      endTime: [this.schedule?.endTime, Validators.required]
    });
  }

  save(): void {
    if (this.scheduleForm.valid) {
      this.activeModal.close({ ...this.schedule, ...this.scheduleForm.value });
    }
  }
}
