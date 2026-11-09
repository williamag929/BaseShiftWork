import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LzButtonDirective } from '../button/lz-button.directive';
import { LzSidePanelComponent } from './lz-side-panel.component';

@Component({
  standalone: true,
  imports: [LzSidePanelComponent, LzButtonDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <mat-sidenav-content id="scroller" style="display:block;overflow:auto">
    <button id="opener" type="button" (click)="open = true">Open</button>
    <button #other id="other" type="button">Other</button>
    <lz-side-panel heading="Edit Ana" subtitle="Basics" [open]="open" [dirty]="dirty" [restoreFocusTo]="useOther ? other : null" (closed)="open = false; closes = closes + 1">
      @if (open) {
        <input id="first" type="text" />
        <input id="second" type="text" />
      }
      <ng-container lzPanelFooter>
        <button lzButton variant="secondary" type="button">Cancel</button>
        <button lzButton variant="primary" type="button">Save</button>
      </ng-container>
    </lz-side-panel>
    </mat-sidenav-content>
  `,
})
class HostComponent {
  open = false;
  dirty = false;
  useOther = false;
  closes = 0;
}

describe('LzSidePanelComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let root: HTMLElement;

  const detect = () => fixture.detectChanges();
  const panel = () => document.querySelector('lz-side-panel [role="dialog"]') as HTMLElement;
  const scrim = () => document.querySelector('lz-side-panel [data-testid="scrim"]') as HTMLElement;
  const closeBtn = () => document.querySelector('lz-side-panel [aria-label="Close"]') as HTMLButtonElement;
  const buttonByText = (t: string) =>
    Array.from(document.querySelectorAll('lz-side-panel button')).find(b => b.textContent!.trim() === t) as HTMLButtonElement;
  const escape = () => panel().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    host = fixture.componentInstance;
    root = fixture.nativeElement;
    detect();
  });
  afterEach(() => {
    if (!fixture.componentRef.hostView.destroyed) {
      host.open = false;
      detect();
    }
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

  it('renders its dialog and scrim outside the sidenav content so nothing stacks above it', async () => {
    await open();
    expect(panel().closest('lz-side-panel')!.parentElement).toBe(document.body);
    expect(root.querySelector('[role="dialog"]')).toBeNull();
    host.open = false;
    detect();
    await fixture.whenStable();
    expect(root.querySelector('lz-side-panel')!.parentElement).toBe(root.querySelector('#scroller') as HTMLElement);
  });

  it('locks the real scroll container while open and restores it after close', async () => {
    const scroller = root.querySelector('#scroller') as HTMLElement;
    expect(getComputedStyle(scroller).overflow).toBe('auto');
    await open();
    expect(getComputedStyle(scroller).overflow).toBe('hidden');
    host.open = false;
    detect();
    expect(getComputedStyle(scroller).overflow).toBe('auto');
  });

  it('restores the scroll container when destroyed while open', async () => {
    const scroller = root.querySelector('#scroller') as HTMLElement;
    await open();
    fixture.destroy();
    expect(getComputedStyle(scroller).overflow).toBe('auto');
    expect(document.body.querySelector(':scope > lz-side-panel')).toBeNull();
  });

  it('Escape pressed outside the panel (body focus) still closes it', async () => {
    await open();
    (document.activeElement as HTMLElement).blur();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.closes).toBe(1);
  });

  it('Escape asks to discard when dirty, from anywhere', async () => {
    host.dirty = true;
    await open();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    detect();
    expect(panel().textContent).toContain('Discard your changes?');
    expect(host.closes).toBe(0);
  });

  it('stops listening for Escape after close', async () => {
    await open();
    host.open = false;
    detect();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.closes).toBe(0);
  });

  it('Escape inside another dialog does not close the panel', async () => {
    await open();
    const other = document.createElement('div');
    other.setAttribute('role', 'dialog');
    document.body.appendChild(other);
    other.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    other.remove();
    expect(host.closes).toBe(0);
  });

  it('Keep editing moves focus to the close button', async () => {
    host.dirty = true;
    await open();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    detect();
    buttonByText('Keep editing').click();
    detect();
    await fixture.whenStable();
    expect(document.activeElement).toBe(closeBtn());
  });

  it('returns focus to restoreFocusTo when given', async () => {
    host.useOther = true;
    await open();
    host.open = false;
    detect();
    await fixture.whenStable();
    expect(document.activeElement!.id).toBe('other');
  });

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
    expect(getComputedStyle(root.querySelector('#scroller') as HTMLElement).overflow).toBe('hidden');
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
    expect(getComputedStyle(root.querySelector('#scroller') as HTMLElement).overflow).toBe('auto');
  });

  it('footer reserves the bottom safe area and the panel respects reduced motion', async () => {
    await open();
    expect(panel().querySelector('footer')!.className).toContain('pb-[env(safe-area-inset-bottom)]');
    expect(panel().className).toContain('motion-reduce:transition-none');
  });
});
