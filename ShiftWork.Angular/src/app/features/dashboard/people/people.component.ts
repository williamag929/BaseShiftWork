import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { People } from 'src/app/core/models/people.model';
import { PeopleService } from 'src/app/core/services/people.service';
import { InviteService } from 'src/app/core/services/invite.service';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { Role } from 'src/app/core/models/role.model';
import { RoleService } from 'src/app/core/services/role.service';
import { InviteStatusResponse } from 'src/app/core/models/invite.model';

@Component({
  selector: 'app-people',
  templateUrl: './people.component.html',
  styleUrls: ['./people.component.css'],
  standalone: false
})
export class PeopleComponent implements OnInit {
  people: People[] = [];
  personForm!: FormGroup;
  selectedPerson: People | null = null;
  activeCompany$: Observable<any>;
  activeCompany: any;
  roles: Role[] = [];
  loading = false;
  error: any = null;
  
  // Invite functionality
  showInviteDialog = false;
  selectedRolesForInvite: number[] = [];
  inviteStatuses: Map<number, InviteStatusResponse> = new Map();
  sendingInvite = false;

  constructor(
    private peopleService: PeopleService,
    private inviteService: InviteService,
    private roleService: RoleService,
    private fb: FormBuilder,
    private toastr: ToastrService,
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
      if (company) {
        this.activeCompany = company;
        this.loading = true;
        this.peopleService.getPeople(company.companyId).subscribe(
          people => {
            this.people = people.filter(p => p.companyId === company.companyId);
            this.loading = false;
            // Load invite statuses after people are loaded
            this.loadInviteStatuses();
          },
          error => {
            this.error = error;
            this.loading = false;
          }
        );
        this.loading = true;
        this.roleService.getRoles(company.companyId).subscribe(
          roles => {
            this.roles = roles;
            this.loading = false;
          },
          error => {
            this.error = error;
            this.loading = false;
          }
        );
      }
    });

    this.personForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: [''],
      pin: ['', [Validators.minLength(4), Validators.maxLength(4)]],
      address: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      externalCode: [''],
      status: ['Active', Validators.required],
      photoUrl: ['']
    });
  }

  editPerson(person: People): void {
    this.selectedPerson = person;
    // Patch form with roleIds array only
    this.personForm.patchValue({
      ...person,
    });
  }

  cancelEdit(): void {
    this.selectedPerson = null;
    this.personForm.reset({
      name: '',
      email: '',
      phoneNumber: '',
      pin: '',
      address: '',
      city: '',
      state: '',
      externalCode: '',
      status: 'Active',
      photoUrl: '',
    });
  }

  savePerson(): void {
    if (!this.personForm.valid) {
      return;
    }

    if (this.selectedPerson) {
      const updatedPerson: People = {
        ...this.selectedPerson,
        ...this.personForm.value,
        // roleIds removed: permissions now managed via CompanyUserProfiles
      };
      this.peopleService.updatePerson(this.activeCompany.companyId, updatedPerson.personId, updatedPerson).subscribe(
        (result) => {
          const index = this.people.findIndex(p => p.personId === result.personId);
          if (index > -1) {
            this.people[index] = result;
          }
          this.toastr.success('Person updated successfully.');
          this.cancelEdit();
        },
        () => this.toastr.error('Failed to update person.')
      );
    } else {
      const newPerson: People = {
        ...this.personForm.value,
        companyId: this.activeCompany.companyId
        // roleIds removed: permissions now managed via CompanyUserProfiles
      };
      this.peopleService.createPerson(newPerson.companyId, newPerson).subscribe(person => {
        this.people.push(person);
        this.cancelEdit();
        this.toastr.success('Person created successfully');
      });
    }
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /**
   * Load invite status for all employees
   */
  loadInviteStatuses(): void {
    if (!this.activeCompany?.companyId) return;

    this.people.forEach(person => {
      this.inviteService.getInviteStatus(this.activeCompany.companyId, person.personId).subscribe(
        status => {
          this.inviteStatuses.set(person.personId, status);
        },
        error => {
          console.error(`Error loading invite status for person ${person.personId}:`, error);
        }
      );
    });
  }

  /**
   * Get invite status for a person
   */
  getInviteStatus(personId: number): InviteStatusResponse | null {
    return this.inviteStatuses.get(personId) || null;
  }

  /**
   * Open invite dialog to select roles
   */
  openInviteDialog(person: People): void {
    if (!person.email) {
      this.toastr.error('Employee must have an email address to receive app invite.');
      return;
    }

    this.selectedPerson = person;
    this.selectedRolesForInvite = [];
    this.showInviteDialog = true;
  }

  /**
   * Close invite dialog
   */
  closeInviteDialog(): void {
    this.showInviteDialog = false;
    this.selectedPerson = null;
    this.selectedRolesForInvite = [];
  }

  /**
   * Toggle role selection for invite
   */
  toggleRoleSelection(roleId: number): void {
    const index = this.selectedRolesForInvite.indexOf(roleId);
    if (index > -1) {
      this.selectedRolesForInvite.splice(index, 1);
    } else {
      this.selectedRolesForInvite.push(roleId);
    }
  }

  /**
   * Check if role is selected
   */
  isRoleSelected(roleId: number): boolean {
    return this.selectedRolesForInvite.includes(roleId);
  }

  /**
   * Send app invite to employee
   */
  sendInvite(): void {
    if (!this.selectedPerson || !this.activeCompany?.companyId) {
      return;
    }

    const status = this.getInviteStatus(this.selectedPerson.personId);
    const isPasswordReset = status?.status === 'Active';

    if (!isPasswordReset && this.selectedRolesForInvite.length === 0) {
      this.toastr.warning('Please select at least one role for the employee.');
      return;
    }

    this.sendingInvite = true;
    this.inviteService.sendInvite(
      this.activeCompany.companyId,
      this.selectedPerson.personId,
      {
        roleIds: this.selectedRolesForInvite,
        inviteUrl: window.location.origin + '/accept-invite'
      }
    ).subscribe(
      response => {
        this.sendingInvite = false;
        const msg = isPasswordReset
          ? `Password reset link sent to ${this.selectedPerson?.email}`
          : `Invite sent to ${this.selectedPerson?.email}`;
        this.toastr.success(msg);
        this.closeInviteDialog();
        this.loadInviteStatuses();
      },
      error => {
        this.sendingInvite = false;
        this.toastr.error(error.message || 'Failed to send invite.');
      }
    );
  }

  /**
   * Get status badge text
   */
  getStatusBadgeText(personId: number): string {
    const status = this.getInviteStatus(personId);
    if (!status) return '';
    
    switch (status.status) {
      case 'Active':
        return 'Has App Access';
      case 'Pending':
        return 'Invite Pending';
      case 'None':
      default:
        return 'Kiosk Only';
    }
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(personId: number): string {
    const status = this.getInviteStatus(personId);
    if (!status) return 'badge-secondary';
    
    switch (status.status) {
      case 'Active':
        return 'badge-success';
      case 'Pending':
        return 'badge-warning';
      case 'None':
      default:
        return 'badge-secondary';
    }
  }

  // getRoleName removed: roles now managed via CompanyUserProfiles

  /**
   * Get the label for the invite button in the edit form
   */
  getInviteActionLabel(personId: number): string {
    const status = this.getInviteStatus(personId);
    switch (status?.status) {
      case 'Active':  return 'Reset App Password';
      case 'Pending': return 'Resend App Invite';
      default:        return 'Send App Invite';
    }
  }

  /**
   * Get dialog title based on current person's invite status
   */
  getDialogTitle(): string {
    if (!this.selectedPerson) return 'Send App Invite';
    const status = this.getInviteStatus(this.selectedPerson.personId);
    switch (status?.status) {
      case 'Active':  return 'Reset App Password';
      case 'Pending': return 'Resend App Invite';
      default:        return 'Send App Invite';
    }
  }

  /**
   * Get dialog description based on current person's invite status
   */
  getDialogDescription(): string {
    if (!this.selectedPerson) return '';
    const status = this.getInviteStatus(this.selectedPerson.personId);
    if (status?.status === 'Active') {
      return 'This employee already has app access. Sending a reset link will invalidate their current password. They will receive an email to set a new password.';
    }
    return 'Select the roles to assign to this employee. They will receive an email invitation to create their account and access the app.';
  }

  /**
   * Get the submit button label inside the dialog
   */
  getDialogSendLabel(): string {
    if (!this.selectedPerson) return 'Send Invite';
    const status = this.getInviteStatus(this.selectedPerson.personId);
    switch (status?.status) {
      case 'Active':  return 'Send Reset Link';
      case 'Pending': return 'Resend Invite';
      default:        return 'Send Invite';
    }
  }

  /**
   * Tooltip for the envelope icon in the people list
   */
  getInviteIconTooltip(personId: number): string {
    const status = this.getInviteStatus(personId);
    switch (status?.status) {
      case 'Active':  return 'Reset app password';
      case 'Pending': return 'Resend invite';
      default:        return 'Send app invite';
    }
  }

  /**
   * Icon class for the inline envelope button in the people list
   */
  getInviteStatusBadgeClass(personId: number): string {
    const status = this.getInviteStatus(personId);
    switch (status?.status) {
      case 'Active':  return 'fa-key';
      case 'Pending': return 'fa-envelope-o';
      default:        return 'fa-envelope';
    }
  }

}
