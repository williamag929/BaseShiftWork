import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzSegmentedComponent } from './lz-segmented.component';

@Component({
  standalone: true,
  imports: [LzSegmentedComponent],
  template: `<lz-segmented ariaLabel="Range" [options]="options" [value]="value" (valueChange)="value = $event" />`,
})
class HostComponent {
  options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }];
  value = 'a';
}

describe('LzSegmentedComponent', () => {
  const setup = () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    return f;
  };

  it('is a labelled group of >=48px aria-pressed buttons that emit and reflect the value', () => {
    const f = setup();
    const root: HTMLElement = f.nativeElement;
    expect(root.querySelector('[role=group]')!.getAttribute('aria-label')).toBe('Range');
    const buttons = Array.from(root.querySelectorAll('button'));
    buttons.forEach(b => expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(48));
    buttons[1].click();
    f.detectChanges();
    expect(buttons.map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  });

  it('keeps the focus ring visible: inset offset on the buttons and no overflow clipping of an outside ring', () => {
    const f = setup();
    const btn = f.nativeElement.querySelector('button') as HTMLButtonElement;
    btn.focus();
    const cs = getComputedStyle(btn);
    expect(btn.matches(':focus-visible')).toBeTrue();
    expect(cs.outlineStyle).not.toBe('none');
    expect(parseFloat(cs.outlineWidth)).toBeGreaterThanOrEqual(2);
    expect(parseFloat(cs.outlineOffset)).toBeLessThanOrEqual(0);
  });

  it('scrolls inside itself instead of widening the page when the host is narrow', () => {
    const f = setup();
    const host = f.nativeElement as HTMLElement;
    host.style.display = 'block';
    host.style.width = '120px';
    expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
  });
});
