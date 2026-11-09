import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzAuthShellComponent } from './lz-auth-shell.component';

@Component({
  standalone: true,
  imports: [LzAuthShellComponent],
  template: `
    <lz-auth-shell title="Sign in" subtitle="Welcome" [wide]="wide"><p id="body">Form</p></lz-auth-shell>
  `,
})
class HostComponent {
  wide = false;
}

describe('LzAuthShellComponent', () => {
  it('renders exactly one h1, the wordmark and projected content', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const root: HTMLElement = f.nativeElement;
    expect(root.querySelectorAll('h1').length).toBe(1);
    expect(root.querySelector('h1')!.textContent).toContain('Sign in');
    expect(root.textContent).toContain('Loqzen');
    expect(root.querySelector('#body')).not.toBeNull();
  });

  it('uses max-w-2xl only when wide', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const card = () => f.nativeElement.querySelector('h1')!.parentElement as HTMLElement;
    expect(card().classList.contains('max-w-md')).toBeTrue();
    expect(card().classList.contains('max-w-2xl')).toBeFalse();
    f.componentInstance.wide = true;
    f.detectChanges();
    expect(card().classList.contains('max-w-2xl')).toBeTrue();
    expect(card().classList.contains('max-w-md')).toBeFalse();
  });
});

describe('LzAuthShellComponent native tooltip', () => {
  it('does not leave a title attribute on the host when the input is set statically', () => {
    @Component({ standalone: true, imports: [LzAuthShellComponent], template: `<lz-auth-shell title="Sign in"></lz-auth-shell>` })
    class TitleHost {}
    const f = TestBed.createComponent(TitleHost);
    f.detectChanges();
    expect(f.nativeElement.querySelector('lz-auth-shell').hasAttribute('title')).toBeFalse();
  });
});
