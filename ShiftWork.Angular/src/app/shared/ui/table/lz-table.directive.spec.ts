import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzTableDirective } from './lz-table.directive';
import { LzTableScrollComponent } from './lz-table-scroll.component';

@Component({
  standalone: true,
  imports: [LzTableDirective, LzTableScrollComponent],
  template: `
    <lz-table-scroll>
      <table lzTable>
        <thead><tr><th>Name</th></tr></thead>
        <tbody><tr><td>Ann</td></tr></tbody>
      </table>
    </lz-table-scroll>
  `,
})
class HostComponent {}

describe('LzTableDirective / LzTableScrollComponent', () => {
  let root: HTMLElement;
  beforeEach(() => {
    const f = TestBed.createComponent(HostComponent);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    root = f.nativeElement;
  });
  afterEach(() => root.remove());

  it('scroll wrapper host scrolls horizontally', () => {
    expect(root.querySelector('lz-table-scroll')!.classList.contains('overflow-x-auto')).toBeTrue();
  });

  it('applies the table class and styles cells like People', () => {
    const table = root.querySelector('table')!;
    expect(table.classList.contains('w-full')).toBeTrue();
    expect(table.classList.contains('border-collapse')).toBeTrue();
    expect(getComputedStyle(root.querySelector('td')!).paddingLeft).toBe('16px');
    expect(getComputedStyle(root.querySelector('td')!).paddingTop).toBe('12px');
    expect(getComputedStyle(root.querySelector('th')!).textTransform).toBe('uppercase');
    expect(getComputedStyle(root.querySelector('th')!).fontSize).toBe('12px');
    expect(getComputedStyle(root.querySelector('lz-table-scroll')!).boxShadow).not.toBe('none');
    expect(getComputedStyle(root.querySelector('thead')!).backgroundColor).toBe('rgb(248, 250, 252)');
    expect(getComputedStyle(root.querySelector('thead tr')!).borderBottomColor).toBe('rgb(221, 227, 236)');
  });
});
