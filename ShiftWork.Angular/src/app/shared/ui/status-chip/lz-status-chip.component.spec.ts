import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzStatusChipComponent } from './lz-status-chip.component';

@Component({
  standalone: true,
  imports: [LzStatusChipComponent],
  template: `
    <lz-status-chip id="a" tone="success">On shift</lz-status-chip>
    <lz-status-chip id="b" tone="success" [dot]="true">With dot</lz-status-chip>
    <lz-status-chip id="c" tone="warning">Draft</lz-status-chip>
  `,
})
class HostComponent {}

describe('LzStatusChipComponent', () => {
  let root: HTMLElement;
  const chip = (id: string) => root.querySelector('#' + id)!;

  beforeEach(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    root = fixture.nativeElement;
  });

  it('renders projected text', () => {
    expect(chip('a').textContent).toContain('On shift');
  });

  it('success tone classes', () => {
    const span = chip('a').querySelector('span')!;
    expect(span.classList.contains('bg-success-bg')).toBeTrue();
    expect(span.classList.contains('text-success-ink')).toBeTrue();
    expect(span.classList.contains('rounded-chip')).toBeTrue();
  });

  it('warning tone classes', () => {
    const span = chip('c').querySelector('span')!;
    expect(span.classList.contains('bg-[var(--lz-draft-bg-1)]')).toBeTrue();
    expect(span.classList.contains('text-amber-ink')).toBeTrue();
  });

  it('dot is hidden from assistive tech', () => {
    expect(chip('b').querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(chip('a').querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
