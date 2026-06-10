import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/core/services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const createGuard = () => TestBed.inject(authGuard);

  beforeEach(() => {
    const authServiceStub = { isLoggedIn: true } as Partial<AuthService>;
    const routerStub = { navigate: jasmine.createSpy('navigate') } as Partial<Router>;

    TestBed.configureTestingModule({
      providers: [
        authGuard,
        { provide: AuthService, useValue: authServiceStub },
        { provide: Router, useValue: routerStub }
      ]
    });
  });

  it('should be created', () => {
    const guard = createGuard();
    expect(guard).toBeTruthy();
  });

  it('should redirect when not logged in', () => {
    const authService = TestBed.inject(AuthService) as any;
    const router = TestBed.inject(Router) as any;
    authService.isLoggedIn = false;

    const guard = createGuard();
    const result = guard.canActivate({} as any, {} as any);

    expect(result).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['sign-in']);
  });

  it('should allow when logged in', () => {
    const authService = TestBed.inject(AuthService) as any;
    const router = TestBed.inject(Router) as any;
    authService.isLoggedIn = true;

    const guard = createGuard();
    const result = guard.canActivate({} as any, {} as any);

    expect(result).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
