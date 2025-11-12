import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { PeopleService } from 'src/app/core/services/people.service';
import { People } from 'src/app/core/models/people.model';
import { PtoConfigModalComponent } from './pto-config-modal.component';

@Component({
  selector: 'app-people-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule, PtoConfigModalComponent],
  templateUrl: './people-management.component.html',
  styleUrls: ['./people-management.component.css']
})
export class PeopleManagementComponent implements OnInit {
  activeCompany$: Observable<any>;
  activeCompany: any;

  loading = false;
  people: People[] = [];
  filteredPeople: People[] = [];
  searchQuery: string = '';

  // PTO config modal state
  showPtoConfigModal = false;
  selectedPerson: People | null = null;

  // Pagination
  page = 1;
  pageSize = 15;

  constructor(
    private store: Store<AppState>,
    private peopleService: PeopleService
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.activeCompany$.subscribe(company => {
      if (company) {
        this.activeCompany = company;
        this.loadPeople();
      }
    });
  }

  loadPeople(): void {
    if (!this.activeCompany?.companyId) return;
    this.loading = true;
    this.peopleService.getPeople(this.activeCompany.companyId).subscribe({
      next: (list) => {
        this.people = list.sort((a, b) => a.name.localeCompare(b.name));
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load people', err);
        this.loading = false;
      }
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.trim().toLowerCase();
    this.filteredPeople = q
      ? this.people.filter(p => 
          p.name.toLowerCase().includes(q) || 
          p.email?.toLowerCase().includes(q)
        )
      : [...this.people];
    this.page = 1;
  }

  get pagedPeople(): People[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredPeople.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredPeople.length / this.pageSize));
  }

  nextPage(): void { if (this.page < this.totalPages) this.page++; }
  prevPage(): void { if (this.page > 1) this.page--; }

  openPtoConfig(person: People): void {
    this.selectedPerson = person;
    this.showPtoConfigModal = true;
  }

  closePtoConfigModal(): void {
    this.showPtoConfigModal = false;
    this.selectedPerson = null;
  }

  onPtoConfigSaved(): void {
    // Optionally reload people or refresh specific person data
  }
}
