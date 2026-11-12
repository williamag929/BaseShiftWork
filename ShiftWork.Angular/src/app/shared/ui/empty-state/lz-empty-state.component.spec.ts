import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzEmptyStateComponent } from './lz-empty-state.component';

@Component({
  standalone: true,
  imports: [LzEmptyStateComponent],
  template: `
    <lz-empty-state icon="group" title="No people" [body]="body">
      <button lzEmptyAction id="act">Add</button>
    </lz-empty-state>
  `,
})
class HostComponent {
  body: string | undefined = 'Add your first person';
}

describe('LzEmptyStateComponent', () => {
  it('renders icon, title, body and action slot', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const root: HTMLElement = f.nativeElement;
    expect(root.querySelector('mat-icon')!.textContent!.trim()).toBe('group');
    expect(root.querySelector('h3')!.textContent).toContain('No people');
    expect(root.textContent).toContain('Add your first person');
    expect(root.querySelector('#act')).not.toBeNull();
  });

  it('omits the body paragraph when not set', () => {
    const f = TestBed.createComponent(HostComponent);
    f.componentInstance.body = undefined;
    f.detectChanges();
    expect(f.nativeElement.querySelector('p')).toBeNull();
  });

  it('renders the icon at 26px on a 56px round tile', () => {
    const f = TestBed.createComponent(HostComponent);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const icon = f.nativeElement.querySelector('mat-icon') as HTMLElement;
    const cs = getComputedStyle(icon);
    expect(cs.width).toBe('26px');
    expect(cs.fontSize).toBe('26px');
    const tile = getComputedStyle(icon.parentElement!);
    expect(tile.width).toBe('56px');
    expect(tile.borderTopLeftRadius).not.toBe('0px');
    f.nativeElement.remove();
  });

  it('is a card on the canvas but flat inside lz-panel', () => {
    const f = TestBed.createComponent(HostComponent);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const empty = f.nativeElement.querySelector('lz-empty-state') as HTMLElement;
    expect(getComputedStyle(empty).boxShadow).not.toBe('none');
    const panel = document.createElement('lz-panel');
    document.body.appendChild(panel);
    panel.appendChild(empty);
    expect(getComputedStyle(empty).boxShadow.replace(/rgba\(0, 0, 0, 0\)/g, '')).not.toMatch(/rgb/);
    expect(getComputedStyle(empty).borderTopWidth).toBe('0px');
    panel.remove();
    f.nativeElement.remove();
  });
});

describe('LzEmptyStateComponent native tooltip', () => {
  it('does not leave a title attribute on the host when the input is set statically', () => {
    @Component({ standalone: true, imports: [LzEmptyStateComponent], template: `<lz-empty-state icon="inbox" title="Nothing here"></lz-empty-state>` })
    class TitleHost {}
    const f = TestBed.createComponent(TitleHost);
    f.detectChanges();
    expect(f.nativeElement.querySelector('lz-empty-state').hasAttribute('title')).toBeFalse();
  });
});
