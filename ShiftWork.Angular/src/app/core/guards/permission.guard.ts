import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PermissionService } from '../services/permission.service';

@Injectable({
  providedIn: 'root'
})
export class PermissionGuard implements CanActivate {
  constructor(
    private permissionService: PermissionService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    const requiredPermissions: string[] = route.data['permissions'] || [];

    if (requiredPermissions.length === 0) {
      return new Observable(observer => {
        observer.next(true);
        observer.complete();
      });
    }

    return this.permissionService.permissions$.pipe(
      map(claims => {
        if (!claims) {
          this.router.navigate(['/login']);
          return false;
        }

        const hasPermission = requiredPermissions.every(p =>
          claims.permissions.includes(p)
        );

        if (!hasPermission) {
          this.router.navigate(['/unauthorized']);
          return false;
        }

        return true;
      })
    );
  }
}
