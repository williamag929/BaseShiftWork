import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzPagerComponent } from './lz-pager.component';

@Component({
  standalone: true,
  imports: [LzPagerComponent],
  template: `<lz-pager [total]="total" [page]="page" [pageSize]="pageSize" (pageChange)="pages.push($event)" (pageSizeChange)="sizes.push($event)" />`,
})
class HostComponent {
  total = 120;
  page = 1;
  pageSize = 25;
  pages: number[] = [];
  sizes: number[] = [];
}

describe('LzPagerComponent', () => {
  let host: HostComponent;
  let root: HTMLElement;
  let detect: () => void;

  beforeEach(() => {
    const f = TestBed.createComponent(HostComponent);
    document.body.appendChild(f.nativeElement);
    host = f.componentInstance;
    root = f.nativeElement;
    detect = () => f.detectChanges();
    detect();
  });
  afterEach(() => root.remove());

  const prev = () => root.querySelector('[aria-label="Previous page"]') as HTMLButtonElement;
  const next = () => root.querySelector('[aria-label="Next page"]') as HTMLButtonElement;

  it('shows the visible range and total', () => {
    expect(root.textContent).toContain('1–25 of 120');
  });

  it('formats large totals with the locale separator', () => {
    host.total = 1000;
    detect();
    expect(root.textContent).toContain('1–25 of 1,000');
  });

  it('shows a short last page range', () => {
    host.page = 5;
    detect();
    expect(root.textContent).toContain('101–120 of 120');
  });

  it('next emits pageChange with the following page', () => {
    next().click();
    expect(host.pages).toEqual([2]);
  });

  it('previous is disabled on the first page and next on the last', () => {
    expect(prev().disabled).toBeTrue();
    expect(next().disabled).toBeFalse();
    host.page = 5;
    detect();
    expect(prev().disabled).toBeFalse();
    expect(next().disabled).toBeTrue();
  });

  it('previous and next are at least 48px', () => {
    expect(prev().getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(next().getBoundingClientRect().width).toBeGreaterThanOrEqual(48);
  });

  it('is hidden when everything fits on the smallest page size', () => {
    host.total = 20;
    detect();
    expect(root.querySelector('lz-pager')!.textContent!.trim()).toBe('');
    expect(root.querySelector('select')).toBeNull();
  });

  it('page size select emits pageSizeChange as a number', () => {
    const select = root.querySelector('select') as HTMLSelectElement;
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    expect(host.sizes).toEqual([50]);
  });
});
