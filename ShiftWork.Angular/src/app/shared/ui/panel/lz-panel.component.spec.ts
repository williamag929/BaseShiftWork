import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzPanelComponent } from './lz-panel.component';

@Component({
  standalone: true,
  imports: [LzPanelComponent],
  template: `
    <lz-panel id="p1" heading="Details">
      <button lzPanelActions id="act">Edit</button>
      <p id="body">Body</p>
    </lz-panel>
    <lz-panel id="p2">
      <button lzPanelActions id="act2">Edit</button>
      <p>Body</p>
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

  it('still shows projected actions when heading is unset', () => {
    const f = TestBed.createComponent(HostComponent);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const act = f.nativeElement.querySelector('#p2 #act2') as HTMLElement;
    expect(act).not.toBeNull();
    expect(act.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(f.nativeElement.querySelector('#p2 h2')).toBeNull();
    f.nativeElement.remove();
  });
});

describe('LzPanelComponent native tooltip', () => {
  it('does not leave a title attribute on the host when the input is set statically', () => {
    @Component({ standalone: true, imports: [LzPanelComponent], template: `<lz-panel heading="Team" title="Team tip"></lz-panel>` })
    class TitleHost {}
    const f = TestBed.createComponent(TitleHost);
    f.detectChanges();
    expect(f.nativeElement.querySelector('lz-panel').hasAttribute('title')).toBeFalse();
  });
});
