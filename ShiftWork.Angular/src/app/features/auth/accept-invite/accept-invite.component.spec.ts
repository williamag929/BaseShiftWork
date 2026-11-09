import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { AuthModule } from '../auth.module';
import { AcceptInviteComponent } from './accept-invite.component';
import { AuthService } from '../../../core/services/auth.service';

describe('AcceptInviteComponent', () => {
  let fixture: ComponentFixture<AcceptInviteComponent>;
  let component: AcceptInviteComponent;
  let root: HTMLElement;

  const setup = async (params: Record<string, string>) => {
    await TestBed.configureTestingModule({
      imports: [AuthModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['acceptInvite']) },
        { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['success', 'error']) },
        { provide: ActivatedRoute, useValue: { queryParams: of(params) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AcceptInviteComponent);
    component = fixture.componentInstance;
    root = fixture.nativeElement;
    fixture.detectChanges();
  };

  const valid = { token: 't', companyId: 'c', personId: '4', name: 'Ana+Diaz', email: 'ana@x.co' };

  it('shows the wide shell with one h1 and one primary button on the form', async () => {
    await setup(valid);
    expect(root.querySelectorAll('h1').length).toBe(1);
    expect(root.querySelector('h1')!.textContent!.trim()).toBe('Accept invitation');
    expect(root.querySelector('lz-auth-shell > div')!.classList.contains('max-w-2xl')).toBeTrue();
    expect(root.querySelectorAll('button[lzButton][variant=primary]').length).toBe(1);
  });

  it('keeps the password toggles in the tab order and toggles visibility', async () => {
    await setup(valid);
    const toggles = Array.from(root.querySelectorAll('button[aria-pressed]')) as HTMLButtonElement[];
    expect(toggles.length).toBe(2);
    expect(toggles[0].getAttribute('tabindex')).not.toBe('-1');
    expect(toggles[0].getBoundingClientRect().width).toBeGreaterThanOrEqual(48);
    toggles[0].click();
    fixture.detectChanges();
    expect((root.querySelector('#password') as HTMLInputElement).type).toBe('text');
    expect(toggles[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('reserves room for the toggle inside the password input', async () => {
    await setup(valid);
    const input = root.querySelector('#password') as HTMLInputElement;
    expect(parseFloat(getComputedStyle(input).paddingRight)).toBeGreaterThanOrEqual(48);
  });

  it('shows an invalid-link alert page with a primary way back when params are missing', async () => {
    await setup({});
    expect(component.invalidLink).toBeTrue();
    expect(root.querySelector('h1')!.textContent!.trim()).toBe('Invalid invite link');
    expect(root.querySelector('a[lzButton][variant=primary]')).toBeTruthy();
    expect(root.querySelector('form')).toBeNull();
  });
});
