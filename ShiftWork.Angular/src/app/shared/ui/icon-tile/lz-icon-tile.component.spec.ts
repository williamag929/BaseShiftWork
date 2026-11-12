import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzIconTileComponent } from './lz-icon-tile.component';

@Component({
  standalone: true,
  imports: [LzIconTileComponent],
  template: `<lz-icon-tile icon="badge" tone="danger" size="md" />`,
})
class HostComponent {}

describe('LzIconTileComponent', () => {
  it('renders a decorative tinted square sized by the size input', () => {
    const f = TestBed.createComponent(HostComponent);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const tile = f.nativeElement.querySelector('lz-icon-tile') as HTMLElement;
    expect(tile.getAttribute('aria-hidden')).toBe('true');
    const cs = getComputedStyle(tile);
    expect(cs.width).toBe('40px');
    expect(cs.backgroundColor).toBe('rgb(251, 233, 230)');
    expect(cs.color).toBe('rgb(163, 50, 31)');
    expect(tile.textContent!.trim()).toBe('badge');
    f.nativeElement.remove();
  });
});
