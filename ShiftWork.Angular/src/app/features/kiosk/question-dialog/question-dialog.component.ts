import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { KioskQuestion } from '../core/models/kiosk-question.model';
import { CommonModule } from '@angular/common';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-question-dialog',
  templateUrl: './question-dialog.component.html',
  styleUrls: ['./question-dialog.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatRadioModule,
    MatButtonModule,
    ReactiveFormsModule
  ]
})
export class QuestionDialogComponent {
  form: FormGroup;
  questions: KioskQuestion[];

  constructor(
    public dialogRef: MatDialogRef<QuestionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { questions: KioskQuestion[] },
    private fb: FormBuilder
  ) {
    this.questions = data.questions;
    const group: any = {};
    this.questions.forEach(q => {
      group[q.kioskQuestionId] = ['', Validators.required];
    });
    this.form = this.fb.group(group);
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }
}
