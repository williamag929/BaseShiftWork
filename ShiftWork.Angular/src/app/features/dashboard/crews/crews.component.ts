import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { CrewService } from 'src/app/core/services/crew.service';
import { PeopleService } from 'src/app/core/services/people.service';
import { Crew, CrewMember } from 'src/app/core/models/crew.model';
import { People } from 'src/app/core/models/people.model';
import { paginate } from 'src/app/shared/ui';

@Component({
  selector: 'app-crews',
  templateUrl: './crews.component.html',
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

  panelOpen = false;
  openerEl: HTMLElement | null = null;
  page = 1;
  pageSize = 25;
  readonly paginate = paginate;
  readonly addCrewLabel = $localize`:@@crews.add_crew:Add crew`;

  readonly crewForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] })
  });
  readonly addPersonControl = new FormControl<number | null>(null);

  saving = false;
  addingMember = false;

  loadingCrews = false;
  loadingMembers = false;
  deletingCrewId: number | null = null;
  removingMemberId: number | null = null;
  crewToDelete: Crew | null = null;
  private deleteOpener: HTMLElement | null = null;
  @ViewChild('addBtn') private addBtn?: ElementRef<HTMLElement>;
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
        this.page = Math.min(this.page, Math.max(1, Math.ceil(crews.length / this.pageSize)));
        if (this.selectedCrew) {
          const refreshed = crews.find(c => c.crewId === this.selectedCrew!.crewId);
          if (refreshed) {
            this.selectedCrew = refreshed;
          }
        }
      },
      error: () => { this.loadingCrews = false; this.error = $localize`:@@crews.load_error:Failed to load crews.`; }
    });
  }

  addCrew(): void {
    this.resetPanel();
    this.panelOpen = true;
  }

  selectCrew(crew: Crew): void {
    this.resetPanel();
    this.selectedCrew = crew;
    this.crewForm.reset({ name: crew.name });
    this.panelOpen = true;
    this.loadMembers(crew.crewId);
  }

  cancelEdit(): void {
    this.panelOpen = false;
    this.resetPanel();
  }

  private resetPanel(): void {
    this.selectedCrew = null;
    this.crewMembers = [];
    this.memberSet = new Set();
    this.addPersonControl.reset(null);
    this.crewForm.reset({ name: '' });
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
        this.error = $localize`:@@crews.members_load_error:Failed to load crew members.`;
      }
    });
  }

  saveCrew(): void {
    if (this.crewForm.invalid || this.saving) return;
    const name = this.crewForm.controls.name.value.trim();
    if (!name) return;
    this.saving = true;
    this.error = '';
    const companyId = String(this.activeCompany.companyId);
    if (!this.selectedCrew) {
      this.crewService.createCrew(companyId, name).subscribe({
        next: crew => {
          this.crews = [...this.crews, crew];
          this.saving = false;
          this.selectCrew(crew);
        },
        error: () => {
          this.saving = false;
          this.error = $localize`:@@crews.create_error:Failed to create crew.`;
        }
      });
      return;
    }
    this.crewService.updateCrew(companyId, this.selectedCrew.crewId, name).subscribe({
      next: () => {
        this.saving = false;
        this.crewForm.reset({ name });
        this.loadCrews();
      },
      error: () => {
        this.saving = false;
        this.error = $localize`:@@crews.save_error:Failed to save crew.`;
      }
    });
  }

  askDelete(crew: Crew, opener: HTMLElement): void {
    this.deleteOpener = opener;
    this.crewToDelete = crew;
  }

  cancelDelete(): void {
    const opener = this.deleteOpener;
    this.crewToDelete = null;
    this.deleteOpener = null;
    Promise.resolve().then(() => opener?.focus());
  }

  confirmDelete(): void {
    const crew = this.crewToDelete;
    if (!crew) return;
    const opener = this.deleteOpener;
    this.crewToDelete = null;
    this.deleteOpener = null;
    this.deletingCrewId = crew.crewId;
    this.error = '';
    this.crewService.deleteCrew(String(this.activeCompany.companyId), crew.crewId).subscribe({
      next: () => {
        this.crews = this.crews.filter(c => c.crewId !== crew.crewId);
        this.page = Math.min(this.page, Math.max(1, Math.ceil(this.crews.length / this.pageSize)));
        this.deletingCrewId = null;
        if (this.selectedCrew?.crewId === crew.crewId) this.cancelEdit();
        Promise.resolve().then(() => this.addBtn?.nativeElement.focus());
      },
      error: () => {
        this.deletingCrewId = null;
        this.error = $localize`:@@crews.delete_error:Failed to delete crew.`;
        Promise.resolve().then(() => opener?.focus());
      }
    });
  }

  get availablePeople(): People[] {
    return this.allPeople.filter(p => !this.memberSet.has(p.personId));
  }

  addMember(): void {
    const personId = this.addPersonControl.value;
    if (!this.selectedCrew || !personId || this.addingMember) return;
    this.addingMember = true;
    this.error = '';
    this.crewService.addPersonToCrew(
      String(this.activeCompany.companyId),
      this.selectedCrew.crewId,
      personId
    ).subscribe({
      next: () => {
        this.addPersonControl.reset(null);
        this.addingMember = false;
        this.loadMembers(this.selectedCrew!.crewId);
      },
      error: () => {
        this.addingMember = false;
        this.error = $localize`:@@crews.add_member_error:Failed to add member.`;
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
        this.error = $localize`:@@crews.remove_member_error:Failed to remove member.`;
      }
    });
  }

  get deleteTitle(): string {
    return $localize`:@@crews.delete_title:Delete ${this.crewToDelete?.name ?? ''}:name:?`;
  }

  get deleteBody(): string {
    return $localize`:@@crews.delete_body:This crew will be deleted. This cannot be undone.`;
  }

  editLabel(crew: Crew): string {
    return $localize`:@@crews.edit_aria:Edit ${crew.name}:name:`;
  }

  deleteLabel(crew: Crew): string {
    return $localize`:@@crews.delete_aria:Delete ${crew.name}:name:`;
  }

  removeLabel(member: CrewMember): string {
    return $localize`:@@crews.remove_aria:Remove ${member.name}:name: from crew`;
  }
}
