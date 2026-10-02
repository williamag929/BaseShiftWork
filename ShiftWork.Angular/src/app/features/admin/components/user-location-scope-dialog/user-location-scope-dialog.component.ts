import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { CompanyUser } from 'src/app/core/models/company-user.model';
import { Location } from 'src/app/core/models/location.model';
import { CompanyUsersService } from 'src/app/core/services/company-users.service';
import { LocationService } from 'src/app/core/services/location.service';

export interface UserLocationScopeDialogData {
  companyId: string;
  user: CompanyUser;
}

@Component({
  selector: 'app-user-location-scope-dialog',
  templateUrl: './user-location-scope-dialog.component.html',
  styleUrls: ['./user-location-scope-dialog.component.css'],
  standalone: false
})
export class UserLocationScopeDialogComponent implements OnInit {
  locations: Location[] = [];
  selected = new Set<number>();
  loading = true;
  saving = false;
  loadFailed = false;
  error: string | null = null;

  // Saved scope ids that are not in the loaded locations list. The user cannot see
  // or toggle them, so they are carried through a save unless the user clicks Clear.
  private hiddenIds = new Set<number>();

  constructor(
    private dialogRef: MatDialogRef<UserLocationScopeDialogComponent, number[] | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: UserLocationScopeDialogData,
    private companyUsersService: CompanyUsersService,
    private locationService: LocationService
  ) {}

  ngOnInit(): void {
    forkJoin({
      locations: this.locationService.getLocations(this.data.companyId),
      scope: this.companyUsersService.getLocationScopes(this.data.companyId, this.data.user.uid)
    }).subscribe({
      next: ({ locations, scope }) => {
        this.locations = this.sortLocations(locations || []);
        const known = new Set(this.locations.map(l => Number(l.locationId)));
        const ids = (scope || []).map(Number);
        this.selected = new Set(ids.filter(id => known.has(id)));
        this.hiddenIds = new Set(ids.filter(id => !known.has(id)));
        this.loading = false;
      },
      error: () => {
        this.loadFailed = true;
        this.error = $localize`:@@company_users_admin.scope.error_load:Could not load locations. Close and try again.`;
        this.loading = false;
      }
    });
  }

  isInactive(location: Location): boolean {
    return !!location.status && location.status.toLowerCase() !== 'active';
  }

  isSelected(id: number): boolean {
    return this.selected.has(Number(id));
  }

  get isEmpty(): boolean {
    return this.selected.size === 0 && this.hiddenIds.size === 0;
  }

  toggle(id: number): void {
    id = Number(id);
    if (this.selected.has(id)) {
      this.selected.delete(id);
    } else {
      this.selected.add(id);
    }
  }

  selectAll(): void {
    this.locations.forEach(l => this.selected.add(Number(l.locationId)));
  }

  clear(): void {
    this.selected.clear();
    this.hiddenIds.clear();
  }

  save(): void {
    if (this.saving || this.loading || this.loadFailed) return;
    this.saving = true;
    this.error = null;
    const ids = Array.from(new Set([...this.selected, ...this.hiddenIds])).sort((a, b) => a - b);
    this.companyUsersService.setLocationScopes(this.data.companyId, this.data.user.uid, ids).subscribe({
      next: (saved) => {
        this.saving = false;
        this.dialogRef.close(saved);
      },
      error: () => {
        // The shared handleError drops the HTTP body, so show a generic message.
        this.error = $localize`:@@company_users_admin.scope.error_save:Could not save the locations. Try again.`;
        this.saving = false;
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  private sortLocations(list: Location[]): Location[] {
    return [...list].sort((a, b) => {
      const ai = this.isInactive(a) ? 1 : 0;
      const bi = this.isInactive(b) ? 1 : 0;
      return ai - bi || (a.name || '').localeCompare(b.name || '');
    });
  }
}
