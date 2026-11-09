import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzEmptyStateComponent } from './lz-empty-state.component';

@Component({
  standalone: true,
  imports: [LzEmptyStateComponent],
  template: `
    <lz-empty-state icon="group" title="No people" [body]="body">
      <button lzEmptyAction id="act">Add</button>
    </lz-empty-state>
  `,
})
class HostComponent {
  body: string | undefined = 'Add your first person';
}

describe('LzEmptyStateComponent', () => {
  it('renders icon, title, body and action slot', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const root: HTMLElement = f.nativeElement;
    expect(root.querySelector('mat-icon')!.textContent!.trim()).toBe('group');
    expect(root.querySelector('h3')!.textContent).toContain('No people');
    expect(root.textContent).toContain('Add your first person');
    expect(root.querySelector('#act')).not.toBeNull();
  });

  it('omits the body paragraph when not set', () => {
    const f = TestBed.createComponent(HostComponent);
    f.componentInstance.body = undefined;
    f.detectChanges();
    expect(f.nativeElement.querySelector('p')).toBeNull();
  });
});
