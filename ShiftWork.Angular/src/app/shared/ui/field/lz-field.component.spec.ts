import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzFieldComponent } from './lz-field.component';
import { LzFieldDirective } from './lz-field.directive';

@Component({
  standalone: true,
  imports: [LzFieldComponent, LzFieldDirective],
  template: `
    <lz-field label="Name" hint="Full name" [error]="error" controlId="nm">
      <input lzField id="nm" aria-invalid="true" />
    </lz-field>
  `,
})
class HostComponent {
  error: string | null = null;
}

describe('LzFieldComponent', () => {
  const setup = () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    return f;
  };

  it('points the label at the control id', () => {
    const root: HTMLElement = setup().nativeElement;
    expect(root.querySelector('label')!.getAttribute('for')).toBe('nm');
    expect(root.querySelector('label')!.textContent!.trim()).toBe('Name');
    expect(root.querySelector('input')!.id).toBe('nm');
  });

  it('renders the hint as a paragraph', () => {
    expect(setup().nativeElement.querySelector('p')!.textContent).toContain('Full name');
  });

  it('renders error in role=alert only when set', () => {
    const f = setup();
    expect(f.nativeElement.querySelector('[role=alert]')).toBeNull();
    f.componentInstance.error = 'Required';
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role=alert]')!.textContent).toContain('Required');
  });

  it('applies control classes to lzField inputs', () => {
    const input = setup().nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.classList.contains('min-h-12')).toBeTrue();
    expect(input.classList.contains('border-line-strong')).toBeTrue();
    expect(getComputedStyle(input).borderTopColor).toBe('rgb(194, 65, 45)');
  });
});
