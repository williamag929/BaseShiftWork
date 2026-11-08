import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzStatusChipComponent } from './lz-status-chip.component';

@Component({
  standalone: true,
  imports: [LzStatusChipComponent],
  template: `
    <lz-status-chip id="a" tone="success">On shift</lz-status-chip>
    <lz-status-chip id="b" tone="success" [dot]="true">With dot</lz-status-chip>
    <lz-status-chip id="n" tone="neutral">N</lz-status-chip>
    <lz-status-chip id="d" tone="danger">D</lz-status-chip>
    <lz-status-chip id="i" tone="info">I</lz-status-chip>
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

  it('neutral, danger and info tone pairs', () => {
    const pairs: [string, string, string][] = [
      ['n', 'bg-neutral-bg', 'text-ink-muted'],
      ['d', 'bg-danger-bg', 'text-danger-ink'],
      ['i', 'bg-info-bg', 'text-info-ink'],
    ];
    for (const [id, bg, fg] of pairs) {
      const c = chip(id).querySelector('span')!.classList;
      expect(c.contains(bg)).withContext(id).toBeTrue();
      expect(c.contains(fg)).withContext(id).toBeTrue();
    }
  });

  it('dot is hidden from assistive tech', () => {
    expect(chip('b').querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(chip('a').querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
