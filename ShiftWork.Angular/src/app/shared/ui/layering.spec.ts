import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LzShiftBlockComponent } from './shift-block/lz-shift-block.component';

@Component({
  standalone: true,
  imports: [LzShiftBlockComponent],
  template: `
    <lz-shift-block status="draft" time="7:00a–3:30p"></lz-shift-block>
    <div class="p-4 border border-line">padded</div>
  `,
})
class HostComponent {}

describe('Bootstrap legacy layer vs Tailwind utilities', () => {
  let fixture: ComponentFixture<HostComponent>;
  const el = (selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => fixture.nativeElement.remove());

  it('keeps the dashed border of a draft shift block', () => {
    expect(getComputedStyle(el('lz-shift-block button')).borderTopStyle).toBe('dashed');
  });

  it('applies the Tailwind spacing scale to p-4', () => {
    expect(getComputedStyle(el('.p-4')).paddingTop).toBe('16px');
  });

  it('uses the token line colour for border-line', () => {
    expect(getComputedStyle(el('.p-4')).borderTopColor).toBe('rgb(221, 227, 236)');
  });
});
