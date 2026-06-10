import { Pipe, PipeTransform } from '@angular/core';
import { PermissionService } from '../services/permission.service';

/**
 * Pipe to check if user has a permission
 * Usage: *ngIf="'people.read' | appHasPermission"
 */
@Pipe({
  name: 'appHasPermission',
  standalone: true
})
export class HasPermissionPipe implements PipeTransform {
  constructor(private permissionService: PermissionService) {}

  transform(permission: string | string[]): boolean {
    if (Array.isArray(permission)) {
      return this.permissionService.hasAllPermissions(permission);
    }
    return this.permissionService.hasPermission(permission);
  }
}
