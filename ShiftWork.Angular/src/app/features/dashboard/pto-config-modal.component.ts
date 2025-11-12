import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PtoService } from 'src/app/core/services/pto.service';
import { People } from 'src/app/core/models/people.model';
import { ConfigurePtoDto } from 'src/app/core/models/pto.model';

@Component({
  selector: 'app-pto-config-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './pto-config-modal.component.html',
  styleUrls: ['./pto-config-modal.component.css']
})
export class PtoConfigModalComponent implements OnInit {
  @Input() person: People | null = null;
  @Input() companyId: string = '';
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  loading = false;
  currentBalance: number | null = null;

  // Form fields
  accrualRatePerMonth: number | null = null;
  startingBalance: number | null = null;
  startDate: string | null = null;

  constructor(
    private ptoService: PtoService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    if (this.person) {
      this.loadCurrentBalance();
      // Pre-fill form if person already has PTO config
      if (this.person.ptoAccrualRatePerMonth !== undefined) {
        this.accrualRatePerMonth = this.person.ptoAccrualRatePerMonth;
      }
      if (this.person.ptoStartingBalance !== undefined) {
        this.startingBalance = this.person.ptoStartingBalance;
      }
      if (this.person.ptoStartDate) {
        const date = new Date(this.person.ptoStartDate);
        this.startDate = date.toISOString().split('T')[0];
      }
    }
  }

  loadCurrentBalance(): void {
    if (!this.companyId || !this.person?.personId) return;
    
    this.ptoService.getBalance(this.companyId, this.person.personId).subscribe({
      next: (bal) => {
        this.currentBalance = bal.balance;
      },
      error: (err) => {
        console.error('Failed to load PTO balance', err);
      }
    });
  }

  save(): void {
    if (!this.person?.personId || !this.companyId) {
      this.snackBar.open('Invalid person or company.', 'Close', { duration: 3000 });
      return;
    }

    // Validate inputs
    if (this.accrualRatePerMonth !== null && this.accrualRatePerMonth < 0) {
      this.snackBar.open('Accrual rate cannot be negative.', 'Close', { duration: 3000 });
      return;
    }

    if (this.startingBalance !== null && this.startingBalance < 0) {
      this.snackBar.open('Starting balance cannot be negative.', 'Close', { duration: 3000 });
      return;
    }

    this.loading = true;

    const config: ConfigurePtoDto = {
      accrualRatePerMonth: this.accrualRatePerMonth ?? undefined,
      startingBalance: this.startingBalance ?? undefined,
      startDate: this.startDate ? new Date(this.startDate) : undefined
    };

    this.ptoService.configurePto(this.companyId, this.person.personId, config).subscribe({
      next: () => {
        this.snackBar.open(`PTO configuration saved for ${this.person!.name}.`, 'Close', { duration: 3000 });
        this.loading = false;
        this.saved.emit();
        this.onClose();
      },
      error: (err) => {
        console.error('Failed to save PTO config', err);
        this.snackBar.open('Failed to save PTO configuration.', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }

  resetForm(): void {
    this.accrualRatePerMonth = null;
    this.startingBalance = null;
    this.startDate = null;
  }
}
