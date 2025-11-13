import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { TimeOffRequestService } from 'src/app/core/services/time-off-request.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { PtoService } from 'src/app/core/services/pto.service';
import { People } from 'src/app/core/models/people.model';
import { TimeOffRequest } from 'src/app/core/models/time-off-request.model';

@Component({
  selector: 'app-time-off-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './time-off-approvals.component.html',
  styleUrls: ['./time-off-approvals.component.css']
})
export class TimeOffApprovalsComponent implements OnInit {
  activeCompany$: Observable<any>;
  activeCompany: any;

  loading = false;
  error: string | null = null;
  requests: TimeOffRequest[] = [];
  people: People[] = [];
  ptoBalances: { [personId: number]: number } = {}; // cache PTO balances

  // Filters
  search: string = '';
  startDate?: string;
  endDate?: string;
  status: 'Pending' | 'Approved' | 'Denied' | 'All' = 'Pending';
  personId?: number;

  // Paging
  page = 1;
  pageSize = 10;

  // Inline notes
  noteText: { [id: number]: string } = {};

  constructor(
    private store: Store<AppState>,
    private timeOffService: TimeOffRequestService,
    private peopleService: PeopleService,
    private ptoService: PtoService,
    private snackBar: MatSnackBar
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.activeCompany$.subscribe(company => {
      if (company) {
        this.activeCompany = company;
        this.loadPeople();
        this.loadRequests();
      }
    });
  }

  get pagedRequests(): TimeOffRequest[] {
    const start = (this.page - 1) * this.pageSize;
    return this.requests.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.requests.length / this.pageSize));
  }

  nextPage(): void { if (this.page < this.totalPages) this.page++; }
  prevPage(): void { if (this.page > 1) this.page--; }

  loadPeople(): void {
    if (!this.activeCompany?.companyId) return;
    this.peopleService.getPeople(this.activeCompany.companyId).subscribe({
      next: (list) => this.people = list,
      error: () => {}
    });
  }

  loadRequests(): void {
    if (!this.activeCompany?.companyId) return;
    this.loading = true;
    this.error = null;

    const start = this.startDate ? new Date(this.startDate) : undefined;
    const end = this.endDate ? new Date(this.endDate) : undefined;
    const statusFilter = this.status === 'All' ? undefined : this.status;

    this.timeOffService
      .getTimeOffRequests(this.activeCompany.companyId, this.personId, statusFilter, start, end)
      .subscribe({
        next: (list) => {
          // Optional client-side search by person name or reason
          const q = this.search.trim().toLowerCase();
          this.requests = q
            ? list.filter(r => (r.personName || '').toLowerCase().includes(q) || (r.reason || '').toLowerCase().includes(q))
            : list;
          this.loading = false;
          this.page = 1; // reset paging on reload
          // Load PTO balances for all persons with pending PTO/Vacation requests
          this.loadPtoBalances();
        },
        error: (err) => {
          console.error('Failed to load time-off requests', err);
          this.error = 'Failed to load time-off requests';
          this.loading = false;
        }
      });
  }

  clearFilters(): void {
    this.search = '';
    this.startDate = undefined;
    this.endDate = undefined;
    this.status = 'Pending';
    this.personId = undefined;
    this.page = 1;
    this.loadRequests();
  }

  approve(request: TimeOffRequest): void {
    if (!this.activeCompany?.companyId) return;
    const notes = this.noteText[request.timeOffRequestId] || '';
    this.timeOffService
      .approveTimeOffRequest(this.activeCompany.companyId, request.timeOffRequestId, true, notes)
      .subscribe({
        next: (res) => {
          this.snackBar.open(`Approved time off for ${request.personName || request.personId}.`, 'Close', { duration: 3000 });
          // Remove from list if we are showing Pending
          this.requests = this.requests.filter(r => r.timeOffRequestId !== request.timeOffRequestId);
        },
        error: (err) => {
          console.error('Approve failed', err);
          this.snackBar.open('Failed to approve request.', 'Close', { duration: 3000 });
        }
      });
  }

  deny(request: TimeOffRequest): void {
    if (!this.activeCompany?.companyId) return;
    const notes = this.noteText[request.timeOffRequestId] || '';
    if (!notes || notes.trim().length === 0) {
      if (!confirm('Deny without notes?')) return;
    }
    this.timeOffService
      .approveTimeOffRequest(this.activeCompany.companyId, request.timeOffRequestId, false, notes)
      .subscribe({
        next: (res) => {
          this.snackBar.open(`Denied time off for ${request.personName || request.personId}.`, 'Close', { duration: 3000 });
          this.requests = this.requests.filter(r => r.timeOffRequestId !== request.timeOffRequestId);
        },
        error: (err) => {
          console.error('Deny failed', err);
          this.snackBar.open('Failed to deny request.', 'Close', { duration: 3000 });
        }
      });
  }

  loadPtoBalances(): void {
    if (!this.activeCompany?.companyId) return;
    // Fetch balance for each unique person with PTO/Vacation request
    const ptoPersons = new Set<number>();
    this.requests.forEach(r => {
      if (r.type === 'Vacation' || r.type === 'PTO') {
        ptoPersons.add(r.personId);
      }
    });
    ptoPersons.forEach(personId => {
      this.ptoService.getBalance(this.activeCompany.companyId, personId).subscribe({
        next: (bal) => {
          this.ptoBalances[personId] = bal.balance;
        },
        error: () => {
          // silently fail; balance will remain undefined
        }
      });
    });
  }

  getPtoBalance(personId: number): number | undefined {
    return this.ptoBalances[personId];
  }

  formatDate(d: Date | string): string {
    const date = new Date(d);
    return date.toLocaleString();
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
}
