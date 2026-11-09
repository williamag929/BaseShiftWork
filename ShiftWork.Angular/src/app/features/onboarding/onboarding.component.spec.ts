import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { OnboardingComponent } from './onboarding.component';
import { RegistrationService, SandboxStatusResponse } from '../../core/services/registration.service';

describe('OnboardingComponent', () => {
  let fixture: ComponentFixture<OnboardingComponent>;
  let component: OnboardingComponent;
  let root: HTMLElement;
  let service: jasmine.SpyObj<RegistrationService>;
  let navigate: jasmine.Spy;

  const withData: SandboxStatusResponse = { hasSandboxData: true, sandboxPersonCount: 3, sandboxAreaCount: 1, sandboxLocationCount: 2 };
  const q = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const qa = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
  const button = (text: string) => qa('button').find((b) => b.textContent!.trim() === text)!;
  const primaries = () => qa('button[lzButton][variant=primary]');

  async function setup(status: SandboxStatusResponse | 'pending' = withData, trialEndsAt?: string): Promise<void> {
    sessionStorage.setItem('onboarding_company_id', 'c1');
    if (trialEndsAt) sessionStorage.setItem('onboarding_trial_ends_at', trialEndsAt);
    service = jasmine.createSpyObj('RegistrationService', ['getSandboxStatus', 'hideSandboxData', 'resetSandboxData', 'deleteSandboxData']);
    service.getSandboxStatus.and.returnValue(status === 'pending' ? new Subject<SandboxStatusResponse>() : of(status));
    await TestBed.configureTestingModule({
      imports: [OnboardingComponent, RouterTestingModule],
      providers: [{ provide: RegistrationService, useValue: service }],
    }).compileComponents();
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(OnboardingComponent);
    component = fixture.componentInstance;
    root = fixture.nativeElement;
    render();
  }

  function render(width = 1280): void {
    root.style.display = 'block';
    root.style.width = `${width}px`;
    fixture.detectChanges();
  }

  afterEach(() => sessionStorage.clear());

  it('renders in the wide auth shell with one h1, step text and exactly one primary button', async () => {
    await setup();
    expect(q('lz-auth-shell > div').classList.contains('max-w-2xl')).toBeTrue();
    expect(qa('h1').length).toBe(1);
    expect(q('h1').textContent!.trim()).toBe('Your account is set up and ready to go.');
    expect(root.textContent).toContain("Four steps to your team's first clock-in.");
    expect(qa('ol > li').length).toBe(4);
    expect(qa('ol > li')[1].textContent).toContain('2');
    expect(q('ol').getAttribute('aria-label')).toBe('Your four setup steps');
    expect(primaries().length).toBe(1);
    expect(primaries()[0].textContent!.trim()).toBe('Go to dashboard');
    expect(button('Explore Pro').getAttribute('variant')).toBe('secondary');
    expect(qa('.btn, .btn-cta, .fa, .onboarding-card, .alert').length).toBe(0);
  });

  it('keeps the dashboard exits: step links, Explore Pro and Go to dashboard', async () => {
    await setup();
    button('Add your first location').click();
    expect(navigate).toHaveBeenCalledWith(['/company-switch'], { queryParams: { next: '/dashboard/locations' } });
    expect(sessionStorage.getItem('onboarding_company_id')).toBeNull();
    button('Explore Pro').click();
    expect(navigate).toHaveBeenCalledWith(['/company-switch'], { queryParams: { next: '/dashboard/billing' } });
    primaries()[0].click();
    expect(navigate).toHaveBeenCalledWith(['/company-switch'], {});
  });

  it('shows a status loading state without the content or any alert while loading', async () => {
    await setup('pending');
    expect(q('[role=status]').textContent).toContain('Loading your workspace');
    expect(qa('ol, button, lz-alert').length).toBe(0);
    expect(qa('h1').length).toBe(1);
  });

  it('shows sandbox counts and three actions when demo data exists', async () => {
    await setup();
    expect(q('section h2').textContent!.trim()).toBe('Your account includes sample data');
    expect(qa('dl dd').map((d) => d.textContent!.trim())).toEqual(['3', '2', '1']);
    expect(qa('dl dt').map((d) => d.textContent!.trim())).toEqual(['Employees', 'Locations', 'Areas']);
    expect(button('Hide demo data')).toBeTruthy();
    expect(button('Reset to defaults')).toBeTruthy();
    expect(button('Remove permanently').getAttribute('variant')).toBe('danger');
    expect(q('lz-alert')).toBeNull();
  });

  it('shows the clean workspace notice instead of the demo section when there is none', async () => {
    await setup({ hasSandboxData: false, sandboxPersonCount: 0, sandboxAreaCount: 0, sandboxLocationCount: 0 });
    expect(root.textContent).toContain('Your workspace is clean and ready for real data.');
    expect(q('lz-alert').getAttribute('role')).toBe('status');
    expect(button('Hide demo data')).toBeUndefined();
  });

  it('hides demo data, announces success in a status alert and reloads', async () => {
    await setup();
    service.hideSandboxData.and.returnValue(of(undefined));
    button('Hide demo data').click();
    fixture.detectChanges();
    expect(service.hideSandboxData).toHaveBeenCalledWith('c1', ['All']);
    expect(q('lz-alert').getAttribute('role')).toBe('status');
    expect(q('lz-alert').textContent).toContain('Demo data has been hidden.');
    expect(service.getSandboxStatus).toHaveBeenCalledTimes(2);
  });

  it('shows failures in an alert-role lz-alert and re-enables the actions', async () => {
    await setup();
    service.resetSandboxData.and.returnValue(throwError(() => ({ status: 500 })));
    button('Reset to defaults').click();
    fixture.detectChanges();
    const alert = q('lz-alert');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('Failed to reset sandbox data.');
    expect(button('Reset to defaults').hasAttribute('disabled')).toBeFalse();
  });

  it('only deletes after confirmation and explains the plan gate on 403', async () => {
    await setup();
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    button('Remove permanently').click();
    expect(service.deleteSandboxData).not.toHaveBeenCalled();
    confirm.and.returnValue(true);
    service.deleteSandboxData.and.returnValue(throwError(() => ({ status: 403 })));
    button('Remove permanently').click();
    fixture.detectChanges();
    expect(q('lz-alert').textContent).toContain('needs a paid plan');
  });

  it('shows the trial end for a trial and the free plan otherwise', async () => {
    await setup(withData, new Date(Date.now() + 10 * 86_400_000).toISOString());
    expect(root.textContent).toContain('Your free trial ends on');
    expect(root.textContent).toContain('Choose a plan any time from Billing.');
    expect(root.textContent).not.toContain('Free plan');
  });

  it('falls back to the free plan copy without a trial', async () => {
    await setup();
    expect(root.textContent).toContain('Free plan');
    expect(root.textContent).toContain('Upgrade to Pro');
  });

  it('uses 48px targets and a filled primary button', async () => {
    await setup();
    expect(getComputedStyle(primaries()[0]).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    for (const el of qa('button')) {
      expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(47.5, el.outerHTML.slice(0, 60));
    }
  });

  for (const width of [360, 768]) {
    it(`has no horizontal overflow at ${width}px`, async () => {
      await setup(withData, new Date(Date.now() + 10 * 86_400_000).toISOString());
      render(width);
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
      expect(q('lz-auth-shell > div').scrollWidth).toBeLessThanOrEqual(q('lz-auth-shell > div').clientWidth);
      qa('button').forEach((b) => expect(b.getBoundingClientRect().right).toBeLessThanOrEqual(width + 0.5));
    });
  }
});
