import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzDialogFrameComponent } from './lz-dialog-frame.component';

@Component({
  standalone: true,
  imports: [LzDialogFrameComponent],
  template: `
    <lz-dialog-frame title="Edit person" subtitle="Update details" [closable]="closable" (closed)="count = count + 1">
      <p id="body">Body</p>
      <button lzDialogActions id="act">Save</button>
    </lz-dialog-frame>
  `,
})
class HostComponent {
  closable = true;
  count = 0;
}

describe('LzDialogFrameComponent', () => {
  const setup = () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    return f;
  };

  it('renders title, subtitle, body and actions', () => {
    const root: HTMLElement = setup().nativeElement;
    expect(root.querySelector('h2')!.textContent).toContain('Edit person');
    expect(root.textContent).toContain('Update details');
    expect(root.querySelector('#body')).not.toBeNull();
    expect(root.querySelector('#act')!.parentElement!.classList.contains('justify-end')).toBeTrue();
  });

  it('close button has aria-label Close and emits closed', () => {
    const f = setup();
    const btn = f.nativeElement.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    expect(btn.querySelector('mat-icon')!.textContent!.trim()).toBe('close');
    btn.click();
    expect(f.componentInstance.count).toBe(1);
  });

  it('Escape on the host emits closed when closable', () => {
    const f = setup();
    f.nativeElement.querySelector('lz-dialog-frame').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(f.componentInstance.count).toBe(1);
  });

  it('hides the close button and ignores Escape when not closable', () => {
    const f = setup();
    f.componentInstance.closable = false;
    f.detectChanges();
    expect(f.nativeElement.querySelector('button[aria-label="Close"]')).toBeNull();
    f.nativeElement.querySelector('lz-dialog-frame').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(f.componentInstance.count).toBe(0);
  });
});
