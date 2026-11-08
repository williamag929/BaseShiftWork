import { Component } from '@angular/core';
import { CdkDrag, CdkDropList, DragDropModule } from '@angular/cdk/drag-drop';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { LzShiftBlockComponent } from './lz-shift-block.component';

@Component({
  standalone: true,
  imports: [LzShiftBlockComponent],
  template: `
    <lz-shift-block
      id="a"
      status="draft"
      time="7:00a–3:30p"
      detail="L3 framing"
      [selectable]="true"
      (activate)="activated = activated + 1"
      (selectedChange)="selection = $event"
    />
    <lz-shift-block id="t" status="timeOff" time="All day" />
    <lz-shift-block id="on" status="published" time="8a–4p" clock="onShift" />
    <lz-shift-block id="late" status="published" time="8a–4p" clock="late" />
  `,
})
class HostComponent {
  activated = 0;
  selection: boolean | null = null;
}

@Component({
  standalone: true,
  imports: [LzShiftBlockComponent, DragDropModule],
  template: `<div cdkDropList><lz-shift-block cdkDrag status="published" time="7a–3p" /></div>`,
})
class DragHostComponent {}

describe('LzShiftBlockComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;
  let root: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    root = fixture.nativeElement;
  });

  it('emits activate when the block is clicked', () => {
    root.querySelector<HTMLButtonElement>('#a button')!.click();
    expect(fixture.componentInstance.activated).toBe(1);
  });

  it('does not emit activate when the selection checkbox is clicked', () => {
    root.querySelector<HTMLInputElement>('#a input[type=checkbox]')!.click();
    expect(fixture.componentInstance.activated).toBe(0);
    expect(fixture.componentInstance.selection).toBe(true);
  });

  it('keeps the checkbox out of the main button', () => {
    expect(root.querySelector('#a button input')).toBeNull();
  });

  it('aria-label names the status', () => {
    expect(root.querySelector('#a button')!.getAttribute('aria-label')).toBe('Draft, 7:00a–3:30p, L3 framing');
  });

  it('names the clock state in the aria-label and uses alarm for late', () => {
    expect(root.querySelector('#on button')!.getAttribute('aria-label')).toBe('Published, 8a–4p, on shift now');
    expect(root.querySelector('#on mat-icon')!.textContent).toContain('schedule');
    expect(root.querySelector('#late button')!.getAttribute('aria-label')).toBe('Published, 8a–4p, late');
    expect(root.querySelector('#late mat-icon')!.textContent).toContain('alarm');
  });

  it('draft uses the hatch', () => {
    expect(root.querySelector('#a button')!.classList.contains('bg-draft-hatch')).toBeTrue();
  });

  it('time off is not a button', () => {
    expect(root.querySelector('#t button')).toBeNull();
    expect(root.querySelector('#t')!.textContent).toContain('All day');
  });

  it('host accepts cdkDrag', () => {
    const f = TestBed.createComponent(DragHostComponent);
    f.detectChanges();
    expect(f.debugElement.query(By.directive(CdkDrag)).injector.get(CdkDrag)).toBeTruthy();
    expect(f.debugElement.query(By.directive(CdkDropList))).toBeTruthy();
  });
});
