import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LzButtonDirective } from './lz-button.directive';

@Component({
  standalone: true,
  imports: [LzButtonDirective],
  template: `
    <button id="default" lzButton>Save</button>
    <button id="primary" lzButton variant="primary">Save</button>
    <button id="danger" lzButton variant="danger">Delete</button>
    <button id="author" lzButton class="w-full">Wide</button>
    <button id="disabled" lzButton variant="primary" [disabled]="isDisabled">Off</button>
    <button id="quietbtn" lzButton variant="quiet">Q</button>
    <button id="toggle" lzButton variant="primary" [disabled]="toggleDisabled">T</button>
    <a id="anchor" lzButton variant="quiet" href="#">Link</a>
    <a id="aria" lzButton variant="primary" aria-disabled="true" href="#">Nope</a>
    <button id="icon" lzButton [iconOnly]="true" aria-label="Edit">E</button>
  `,
})
class HostComponent {
  isDisabled = true;
  toggleDisabled = true;
}

describe('LzButtonDirective', () => {
  let root: HTMLElement;
  let fixture: ComponentFixture<HostComponent>;
  const el = (id: string) => root.querySelector<HTMLElement>('#' + id)!;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    root = fixture.nativeElement;
  });

  it('defaults to secondary md', () => {
    const c = el('default').classList;
    expect(c.contains('border-line-strong')).toBeTrue();
    expect(c.contains('bg-paper')).toBeTrue();
    expect(c.contains('min-h-12')).toBeTrue();
  });

  it('primary uses ink background and paper text', () => {
    const c = el('primary').classList;
    expect(c.contains('bg-ink')).toBeTrue();
    expect(c.contains('text-paper')).toBeTrue();
    expect(c.contains('border-ink')).toBeTrue();
  });

  it('danger uses danger background', () => {
    expect(el('danger').classList.contains('bg-danger')).toBeTrue();
    expect(el('danger').classList.contains('border-danger')).toBeTrue();
  });

  it('quiet buttons are transparent with a transparent border', () => {
    const c = el('quietbtn').classList;
    expect(c.contains('bg-transparent')).toBeTrue();
    expect(c.contains('border')).toBeTrue();
    expect(c.contains('border-transparent')).toBeTrue();
  });

  it('toggling disabled restores variant classes', () => {
    expect(el('toggle').classList.contains('bg-neutral-bg')).toBeTrue();
    fixture.componentInstance.toggleDisabled = false;
    fixture.detectChanges();
    const c = el('toggle').classList;
    expect(c.contains('bg-neutral-bg')).toBeFalse();
    expect(c.contains('cursor-not-allowed')).toBeFalse();
    expect(c.contains('bg-ink')).toBeTrue();
    expect(c.contains('text-paper')).toBeTrue();
  });

  it('keeps author classes', () => {
    expect(el('author').classList.contains('w-full')).toBeTrue();
    expect(el('author').classList.contains('min-h-12')).toBeTrue();
  });

  it('disabled state uses neutral colors', () => {
    const c = el('disabled').classList;
    expect(c.contains('bg-neutral-bg')).toBeTrue();
    expect(c.contains('cursor-not-allowed')).toBeTrue();
    expect(c.contains('bg-ink')).toBeFalse();
  });

  it('treats aria-disabled anchors as disabled', () => {
    const c = el('aria').classList;
    expect(c.contains('bg-neutral-bg')).toBeTrue();
    expect(c.contains('bg-ink')).toBeFalse();
  });

  it('works on anchors', () => {
    expect(el('anchor').classList.contains('text-link')).toBeTrue();
  });

  it('icon-only buttons are 48px squares', () => {
    const c = el('icon').classList;
    expect(c.contains('w-12')).toBeTrue();
    expect(c.contains('px-0')).toBeTrue();
    expect(c.contains('px-4')).toBeFalse();
  });
});
