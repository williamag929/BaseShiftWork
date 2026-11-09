import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LzButtonDirective } from '../button/lz-button.directive';
import { LzSidePanelComponent } from './lz-side-panel.component';

@Component({
  standalone: true,
  imports: [LzSidePanelComponent, LzButtonDirective],
  template: `
    <button id="opener" type="button" (click)="open = true">Open</button>
    <lz-side-panel heading="Edit Ana" subtitle="Basics" [open]="open" [dirty]="dirty" (closed)="open = false; closes = closes + 1">
      @if (open) {
        <input id="first" type="text" />
        <input id="second" type="text" />
      }
      <ng-container lzPanelFooter>
        <button lzButton variant="secondary" type="button">Cancel</button>
        <button lzButton variant="primary" type="button">Save</button>
      </ng-container>
    </lz-side-panel>
  `,
})
class HostComponent {
  open = false;
  dirty = false;
  closes = 0;
}

describe('LzSidePanelComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let root: HTMLElement;

  const detect = () => fixture.detectChanges();
  const panel = () => root.querySelector('[role="dialog"]') as HTMLElement;
  const scrim = () => root.querySelector('[data-testid="scrim"]') as HTMLElement;
  const closeBtn = () => root.querySelector('[aria-label="Close"]') as HTMLButtonElement;
  const buttonByText = (t: string) =>
    Array.from(root.querySelectorAll('button')).find(b => b.textContent!.trim() === t) as HTMLButtonElement;
  const escape = () => panel().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    host = fixture.componentInstance;
    root = fixture.nativeElement;
    detect();
  });
  afterEach(() => {
    host.open = false;
    detect();
    root.remove();
  });

  async function open() {
    const opener = root.querySelector('#opener') as HTMLButtonElement;
    opener.focus();
    host.open = true;
    detect();
    await fixture.whenStable();
    detect();
  }

  it('renders nothing while closed', () => {
    expect(panel()).toBeNull();
    expect(scrim()).toBeNull();
  });

  it('is a modal dialog labelled by its heading', async () => {
    await open();
    expect(panel().getAttribute('aria-modal')).toBe('true');
    const h2 = panel().querySelector('h2')!;
    expect(h2.textContent).toContain('Edit Ana');
    expect(panel().getAttribute('aria-labelledby')).toBe(h2.id);
    expect(h2.id).not.toBe('');
  });

  it('is full width and a 30rem drawer from lg', async () => {
    await open();
    expect(panel().classList.contains('w-full')).toBeTrue();
    expect(panel().classList.contains('lg:w-[30rem]')).toBeTrue();
    expect(scrim().classList.contains('bg-navy-900/40')).toBeTrue();
  });

  it('projects the body and a footer with the actions', async () => {
    await open();
    expect(panel().querySelector('#first')).not.toBeNull();
    expect(panel().querySelector('footer')!.textContent).toContain('Save');
  });

  it('moves focus to the first field and locks body scroll', async () => {
    await open();
    expect(document.activeElement!.id).toBe('first');
    expect(document.body.classList.contains('overflow-hidden')).toBeTrue();
  });

  it('Escape closes immediately when not dirty', async () => {
    await open();
    escape();
    expect(host.closes).toBe(1);
  });

  it('scrim and close button close immediately when not dirty', async () => {
    await open();
    scrim().click();
    closeBtn().click();
    expect(host.closes).toBe(2);
  });

  it('asks before discarding when dirty, for Escape, scrim and the close button', async () => {
    host.dirty = true;
    await open();
    for (const trigger of [escape, () => scrim().click(), () => closeBtn().click()]) {
      trigger();
      detect();
      expect(panel().textContent).toContain('Discard your changes?');
      expect(host.closes).toBe(0);
      buttonByText('Keep editing').click();
      detect();
      expect(panel().textContent).not.toContain('Discard your changes?');
    }
  });

  it('emits closed only after Discard is clicked', async () => {
    host.dirty = true;
    await open();
    escape();
    detect();
    buttonByText('Discard').click();
    expect(host.closes).toBe(1);
  });

  it('Discard uses the danger ink and both confirm buttons are lzButtons', async () => {
    host.dirty = true;
    await open();
    escape();
    detect();
    const label = buttonByText('Discard').querySelector('span')!;
    expect(label.classList.contains('text-danger-ink')).toBeTrue();
    expect(getComputedStyle(label).color).toBe('rgb(163, 50, 31)');
    expect(buttonByText('Keep editing').getAttribute('variant')).toBe('secondary');
    expect(buttonByText('Discard').getAttribute('variant')).toBe('secondary');
  });

  it('returns focus to the opener after close and unlocks scroll', async () => {
    await open();
    host.open = false;
    detect();
    await fixture.whenStable();
    expect(document.activeElement!.id).toBe('opener');
    expect(document.body.classList.contains('overflow-hidden')).toBeFalse();
  });

  it('footer reserves the bottom safe area and the panel respects reduced motion', async () => {
    await open();
    expect(panel().querySelector('footer')!.className).toContain('pb-[env(safe-area-inset-bottom)]');
    expect(panel().className).toContain('motion-reduce:transition-none');
  });
});
