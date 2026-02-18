import { Pipe, PipeTransform } from '@angular/core';
import { PermissionService } from '../services/permission.service';

/**
 * Pipe to check if user has any of the permissions
 * Usage: *ngIf="['people.read', 'people.write'] | appHasAnyPermission"
 */
@Pipe({
  name: 'appHasAnyPermission',
  standalone: true
})
export class HasAnyPermissionPipe implements PipeTransform {
  constructor(private permissionService: PermissionService) {}

  transform(permissions: string[]): boolean {
    return this.permissionService.hasAnyPermission(permissions);
  }
}
