import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzAlertComponent } from './lz-alert.component';

@Component({
  standalone: true,
  imports: [LzAlertComponent],
  template: `
    <lz-alert id="i">Info</lz-alert>
    <lz-alert id="s" tone="success">Ok</lz-alert>
    <lz-alert id="w" tone="warning">Warn</lz-alert>
    <lz-alert id="d" tone="danger">Bad</lz-alert>
  `,
})
class HostComponent {}

describe('LzAlertComponent', () => {
  let root: HTMLElement;
  afterEach(() => root.remove());
  beforeEach(() => {
    const f = TestBed.createComponent(HostComponent);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    root = f.nativeElement;
  });

  it('uses role=alert for danger and role=status otherwise', () => {
    expect(root.querySelector('#d')!.getAttribute('role')).toBe('alert');
    for (const id of ['i', 's', 'w']) {
      expect(root.querySelector('#' + id)!.getAttribute('role')).toBe('status');
    }
  });

  it('renders a leading icon per tone', () => {
    const icon = (id: string) => root.querySelector(`#${id} mat-icon`)!.textContent!.trim();
    expect(icon('i')).toBe('info');
    expect(icon('s')).toBe('check_circle');
    expect(icon('w')).toBe('warning');
    expect(icon('d')).toBe('error');
  });

  it('colours each tone from its tokens', () => {
    const resolve = (prop: 'backgroundColor' | 'color', token: string) => {
      const probe = document.createElement('span');
      probe.style[prop] = `var(${token})`;
      root.appendChild(probe);
      const v = getComputedStyle(probe)[prop];
      probe.remove();
      return v;
    };
    const cases: [string, string, string][] = [
      ['i', '--lz-info-bg', '--lz-info-ink'],
      ['s', '--lz-success-bg', '--lz-success-ink'],
      ['w', '--lz-draft-bg-1', '--lz-amber-ink'],
      ['d', '--lz-danger-bg', '--lz-danger-ink'],
    ];
    for (const [id, bg, ink] of cases) {
      const cs = getComputedStyle(root.querySelector('#' + id)!);
      expect(cs.backgroundColor).withContext(id + ' bg').toBe(resolve('backgroundColor', bg));
      expect(cs.color).withContext(id + ' ink').toBe(resolve('color', ink));
    }
  });
});
