import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { KioskQuestion } from '../core/models/kiosk-question.model';
import { CommonModule } from '@angular/common';
import { LzButtonDirective } from 'src/app/shared/ui/button/lz-button.directive';
import { LzDialogFrameComponent } from 'src/app/shared/ui/dialog/lz-dialog-frame.component';

@Component({
  selector: 'app-question-dialog',
  templateUrl: './question-dialog.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    ReactiveFormsModule,
    LzButtonDirective,
    LzDialogFrameComponent
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

  get closable(): boolean {
    return !this.dialogRef.disableClose;
  }

  onClose(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }
}
