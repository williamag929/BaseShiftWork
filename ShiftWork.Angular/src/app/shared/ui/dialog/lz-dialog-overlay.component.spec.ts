import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LzDialogFrameComponent } from './lz-dialog-frame.component';
import { LzDialogOverlayComponent } from './lz-dialog-overlay.component';

@Component({
  standalone: true,
  imports: [LzDialogOverlayComponent, LzDialogFrameComponent],
  template: `
    <button id="outside">Outside</button>
    <lz-dialog-overlay [dialogRole]="role" (closed)="count = count + 1">
      <lz-dialog-frame title="Edit thing" [closable]="false">
        <input id="first" />
        <input id="last" />
        <button lzDialogActions id="act">Save</button>
      </lz-dialog-frame>
    </lz-dialog-overlay>
  `,
})
class HostComponent {
  role: 'dialog' | 'alertdialog' = 'dialog';
  count = 0;
}

@Component({
  standalone: true,
  imports: [LzDialogOverlayComponent, LzDialogFrameComponent],
  template: `
    @if (lower) {
      <lz-dialog-overlay (closed)="lowerCount = lowerCount + 1"><lz-dialog-frame title="Lower"><button id="lower-btn">L</button></lz-dialog-frame></lz-dialog-overlay>
    }
    @if (top) {
      <lz-dialog-overlay placement="end" ariaLabel="Top" (closed)="topCount = topCount + 1"><button id="top-btn">T</button></lz-dialog-overlay>
    }
  `,
})
class StackHostComponent {
  lower = true;
  top = true;
  lowerCount = 0;
  topCount = 0;
}

@Component({
  standalone: true,
  imports: [LzDialogOverlayComponent, LzDialogFrameComponent],
  template: `
    <lz-dialog-overlay (closed)="overlayCount = overlayCount + 1">
      <lz-dialog-frame title="Closable" (closed)="frameCount = frameCount + 1"><input id="in" /></lz-dialog-frame>
    </lz-dialog-overlay>
  `,
})
class ClosableHostComponent {
  overlayCount = 0;
  frameCount = 0;
}

describe('LzDialogOverlayComponent stacking', () => {
  const escape = (target: EventTarget) => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  async function stack() {
    const f = TestBed.createComponent(StackHostComponent);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return f;
  }

  it('Escape on body closes only the top overlay, then the lower one once the top is gone', async () => {
    const f = await stack();
    escape(document.body);
    expect(f.componentInstance.topCount).toBe(1);
    expect(f.componentInstance.lowerCount).toBe(0);
    f.componentInstance.top = false;
    f.detectChanges();
    escape(document.body);
    expect(f.componentInstance.topCount).toBe(1);
    expect(f.componentInstance.lowerCount).toBe(1);
  });

  it('a drawer mounted after a dialog overlay closes on body Escape', async () => {
    const f = await stack();
    escape(document.body);
    expect(f.componentInstance.topCount).toBe(1);
  });

  it('a foreign modal later in the DOM still blocks the lower overlay, one earlier does not', async () => {
    const f = await stack();
    f.componentInstance.top = false;
    f.detectChanges();
    const after = document.createElement('div');
    after.setAttribute('role', 'dialog');
    after.setAttribute('aria-modal', 'true');
    document.body.appendChild(after);
    escape(document.body);
    expect(f.componentInstance.lowerCount).toBe(0);
    after.remove();
    const before = document.createElement('div');
    before.setAttribute('role', 'alertdialog');
    before.setAttribute('aria-modal', 'true');
    document.body.insertBefore(before, document.body.firstChild);
    escape(document.body);
    expect(f.componentInstance.lowerCount).toBe(1);
    before.remove();
  });

  it('Escape inside a closable frame is emitted by the frame exactly once and not by the overlay', async () => {
    const f = TestBed.createComponent(ClosableHostComponent);
    f.detectChanges();
    await f.whenStable();
    escape(f.nativeElement.querySelector('#in'));
    expect(f.componentInstance.frameCount).toBe(1);
    expect(f.componentInstance.overlayCount).toBe(0);
  });
});

describe('LzDialogOverlayComponent', () => {
  let f: ComponentFixture<HostComponent>;
  const root = () => f.nativeElement as HTMLElement;
  const escape = (target: EventTarget) => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  beforeEach(async () => {
    f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
  });

  it('is a labelled modal with the selected role', () => {
    const dialog = root().querySelector('[aria-modal="true"]') as HTMLElement;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(root().querySelector('#' + dialog.getAttribute('aria-labelledby'))!.textContent).toContain('Edit thing');
    f.componentInstance.role = 'alertdialog';
    f.detectChanges();
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(root().querySelector('lz-dialog-overlay')!.hasAttribute('role')).toBeFalse();
  });

  it('keeps the frame as the projection host for dialog actions', () => {
    expect(root().querySelector('lz-dialog-frame #act')!.parentElement!.classList).toContain('justify-end');
  });

  it('closes on Escape dispatched on document.body and on a scrim click', () => {
    escape(document.body);
    expect(f.componentInstance.count).toBe(1);
    (root().querySelector('[data-testid="scrim"]') as HTMLElement).click();
    expect(f.componentInstance.count).toBe(2);
  });

  it('leaves Escape from inside the frame to the frame itself', () => {
    root().querySelector('lz-dialog-frame')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(f.componentInstance.count).toBe(0);
  });

  it('ignores Escape while another modal is open outside it', () => {
    const foreign = document.createElement('div');
    foreign.setAttribute('role', 'alertdialog');
    foreign.setAttribute('aria-modal', 'true');
    document.body.appendChild(foreign);
    try {
      escape(document.body);
      expect(f.componentInstance.count).toBe(0);
    } finally {
      foreign.remove();
    }
    escape(document.body);
    expect(f.componentInstance.count).toBe(1);
  });

  it('stops listening after destroy', () => {
    f.destroy();
    escape(document.body);
    expect(f.componentInstance.count).toBe(0);
  });

  it('puts initial focus inside the dialog and wraps Tab from the last focusable to the first', () => {
    const dialog = root().querySelector('[aria-modal="true"]') as HTMLElement;
    expect(dialog.contains(document.activeElement)).toBeTrue();
    expect(document.activeElement).not.toBe(root().querySelector('#outside'));
    const anchors = Array.from(root().querySelectorAll<HTMLElement>('.cdk-focus-trap-anchor'));
    expect(anchors.length).toBe(2);
    (root().querySelector('#act') as HTMLElement).focus();
    anchors[1].focus();
    expect(document.activeElement).toBe(dialog.querySelector('input'));
  });
});
