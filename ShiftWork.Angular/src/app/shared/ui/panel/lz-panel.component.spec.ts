import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzPanelComponent } from './lz-panel.component';

@Component({
  standalone: true,
  imports: [LzPanelComponent],
  template: `
    <lz-panel heading="Details">
      <button lzPanelActions id="act">Edit</button>
      <p id="body">Body</p>
    </lz-panel>
  `,
})
class HostComponent {}

describe('LzPanelComponent', () => {
  it('renders heading, projected actions and body on a panel surface', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const root: HTMLElement = f.nativeElement;
    expect(root.querySelector('h2')!.textContent).toContain('Details');
    expect(root.querySelector('#act')!.parentElement!.classList.contains('ml-auto')).toBeTrue();
    expect(root.querySelector('#body')).not.toBeNull();
    const host = root.querySelector('lz-panel')!;
    expect(host.classList.contains('rounded-panel')).toBeTrue();
    expect(host.classList.contains('bg-paper')).toBeTrue();
  });
});
