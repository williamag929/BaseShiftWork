import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzSummaryItem, LzSummaryStripComponent } from './lz-summary-strip.component';

@Component({
  standalone: true,
  imports: [LzSummaryStripComponent],
  template: `<lz-summary-strip [items]="items" [interactive]="interactive" (itemSelect)="picked = $event" />`,
})
class HostComponent {
  items: LzSummaryItem[] = [
    { id: 'drafts', count: 4, label: 'Drafts', tone: 'draft' },
    { id: 'open', count: 2, label: 'Open', tone: 'open' },
  ];
  picked = '';
  interactive = true;
}

describe('LzSummaryStripComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;
  let root: HTMLElement;
  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    root = fixture.nativeElement;
  });

  it('renders one button per item with its count', () => {
    const buttons = root.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain('4');
    expect(buttons[0].textContent).toContain('Drafts');
  });

  it('emits the item id on click', () => {
    root.querySelectorAll('button')[1].click();
    expect(fixture.componentInstance.picked).toBe('open');
  });

  it('renders non-interactive items without buttons when interactive is false', () => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.interactive = false;
    fixture.detectChanges();
    root = fixture.nativeElement;
    expect(root.querySelectorAll('button').length).toBe(0);
    expect(root.textContent).toContain('Drafts');
    expect(root.textContent).toContain('4');
  });
});
