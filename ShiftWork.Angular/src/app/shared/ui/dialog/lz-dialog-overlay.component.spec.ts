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
