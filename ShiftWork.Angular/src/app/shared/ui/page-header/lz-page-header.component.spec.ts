import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzPageHeaderComponent } from './lz-page-header.component';

@Component({
  standalone: true,
  imports: [LzPageHeaderComponent],
  template: `
    <lz-page-header title="Schedule" subtitle="Week of Nov 8">
      <span lzHeaderMeta id="meta">meta</span>
      <button lzHeaderActions id="act">Publish</button>
    </lz-page-header>
  `,
})
class HostComponent {}

describe('LzPageHeaderComponent', () => {
  let root: HTMLElement;
  beforeEach(() => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    root = f.nativeElement;
  });

  it('renders title as h1', () => {
    expect(root.querySelector('h1')!.textContent!.trim()).toBe('Schedule');
    expect(root.textContent).toContain('Week of Nov 8');
  });

  it('projects actions into the right slot', () => {
    const slot = root.querySelector('#act')!.parentElement!;
    expect(slot.classList.contains('ml-auto')).toBeTrue();
    expect(root.querySelector('#meta')).not.toBeNull();
  });
});
