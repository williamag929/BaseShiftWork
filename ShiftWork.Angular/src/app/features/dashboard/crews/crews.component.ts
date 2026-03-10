import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { CrewService } from 'src/app/core/services/crew.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { Crew, CrewMember } from 'src/app/core/models/crew.model';
import { People } from 'src/app/core/models/people.model';

@Component({
  selector: 'app-crews',
  templateUrl: './crews.component.html',
  styleUrls: ['./crews.component.css'],
  standalone: false
})
export class CrewsComponent implements OnInit {
  activeCompany$: Observable<any>;
  activeCompany: any;

  crews: Crew[] = [];
  selectedCrew: Crew | null = null;
  crewMembers: CrewMember[] = [];
  allPeople: People[] = [];
  memberSet: Set<number> = new Set();

  // Create new crew
  showCreateForm = false;
  newCrewName = '';
  creating = false;

  // Edit crew name
  editName = '';
  saving = false;

  // Add member
  addPersonId: number | null = null;
  addingMember = false;

  // States
  loadingCrews = false;
  loadingMembers = false;
  deletingCrewId: number | null = null;
  removingMemberId: number | null = null;
  error = '';

  constructor(
    private store: Store<AppState>,
    private crewService: CrewService,
    private peopleService: PeopleService
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.activeCompany$.subscribe(company => {
      if (company) {
        this.activeCompany = company;
        this.loadCrews();
        this.peopleService.getPeople(String(company.companyId), 1, 500).subscribe({
          next: people => { this.allPeople = people; },
          error: () => { this.allPeople = []; }
        });
      }
    });
  }

  loadCrews(): void {
    this.loadingCrews = true;
    this.error = '';
    this.crewService.getCrews(String(this.activeCompany.companyId)).subscribe({
      next: crews => {
        this.crews = crews;
        this.loadingCrews = false;
        // Re-select current crew after refresh
        if (this.selectedCrew) {
          const refreshed = crews.find(c => c.crewId === this.selectedCrew!.crewId);
          if (refreshed) {
            this.selectedCrew = refreshed;
            this.editName = refreshed.name;
          }
        }
      },
      error: () => { this.loadingCrews = false; this.error = 'Failed to load crews.'; }
    });
  }

  selectCrew(crew: Crew): void {
    this.selectedCrew = crew;
    this.editName = crew.name;
    this.addPersonId = null;
    this.error = '';
    this.loadMembers(crew.crewId);
  }

  cancelEdit(): void {
    this.selectedCrew = null;
    this.crewMembers = [];
    this.memberSet = new Set();
    this.addPersonId = null;
    this.error = '';
  }

  private loadMembers(crewId: number): void {
    this.loadingMembers = true;
    this.crewService.getCrewMembers(String(this.activeCompany.companyId), crewId).subscribe({
      next: members => {
        this.crewMembers = members;
        this.memberSet = new Set(members.map(m => m.personId));
        this.loadingMembers = false;
      },
      error: () => {
        this.loadingMembers = false;
        this.error = 'Failed to load crew members.';
      }
    });
  }

  // ── Create ──────────────────────────────────────────────────
  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    if (!this.showCreateForm) this.newCrewName = '';
  }

  createCrew(): void {
    const name = this.newCrewName.trim();
    if (!name || this.creating) return;
    this.creating = true;
    this.error = '';
    this.crewService.createCrew(String(this.activeCompany.companyId), name).subscribe({
      next: crew => {
        this.crews = [...this.crews, crew];
        this.newCrewName = '';
        this.showCreateForm = false;
        this.creating = false;
        this.selectCrew(crew);
      },
      error: () => {
        this.creating = false;
        this.error = 'Failed to create crew.';
      }
    });
  }

  // ── Update ──────────────────────────────────────────────────
  saveCrew(): void {
    if (!this.selectedCrew || this.saving) return;
    const name = this.editName.trim();
    if (!name) return;
    this.saving = true;
    this.error = '';
    this.crewService.updateCrew(String(this.activeCompany.companyId), this.selectedCrew.crewId, name).subscribe({
      next: () => {
        this.saving = false;
        this.loadCrews();
      },
      error: () => {
        this.saving = false;
        this.error = 'Failed to save crew.';
      }
    });
  }

  // ── Delete ──────────────────────────────────────────────────
  deleteCrew(crew: Crew): void {
    if (!confirm(`Delete crew "${crew.name}"? This cannot be undone.`)) return;
    this.deletingCrewId = crew.crewId;
    this.error = '';
    this.crewService.deleteCrew(String(this.activeCompany.companyId), crew.crewId).subscribe({
      next: () => {
        this.crews = this.crews.filter(c => c.crewId !== crew.crewId);
        this.deletingCrewId = null;
        if (this.selectedCrew?.crewId === crew.crewId) this.cancelEdit();
      },
      error: () => {
        this.deletingCrewId = null;
        this.error = 'Failed to delete crew.';
      }
    });
  }

  // ── Members ─────────────────────────────────────────────────
  get availablePeople(): People[] {
    return this.allPeople.filter(p => !this.memberSet.has(p.personId));
  }

  addMember(): void {
    if (!this.selectedCrew || !this.addPersonId || this.addingMember) return;
    this.addingMember = true;
    this.error = '';
    this.crewService.addPersonToCrew(
      String(this.activeCompany.companyId),
      this.selectedCrew.crewId,
      this.addPersonId
    ).subscribe({
      next: () => {
        this.addPersonId = null;
        this.addingMember = false;
        this.loadMembers(this.selectedCrew!.crewId);
      },
      error: () => {
        this.addingMember = false;
        this.error = 'Failed to add member.';
      }
    });
  }

  removeMember(personId: number): void {
    if (!this.selectedCrew) return;
    this.removingMemberId = personId;
    this.error = '';
    this.crewService.removePersonFromCrew(
      String(this.activeCompany.companyId),
      this.selectedCrew.crewId,
      personId
    ).subscribe({
      next: () => {
        this.removingMemberId = null;
        this.loadMembers(this.selectedCrew!.crewId);
      },
      error: () => {
        this.removingMemberId = null;
        this.error = 'Failed to remove member.';
      }
    });
  }
}
