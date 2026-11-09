import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatToolbarModule, MatDialogModule],
  template: `
    <mat-toolbar>Title</mat-toolbar>
    <mat-card>Card</mat-card>
    <button mat-flat-button>Save</button>
    <div class="mat-mdc-dialog-container"><div class="mat-mdc-dialog-surface mdc-dialog__surface"></div></div>
    <div class="toast-success"></div>
    <div class="toast-error"></div>
  `,
})
class HostComponent {}

describe('Material theme from tokens', () => {
  let fixture: ComponentFixture<HostComponent>;

  const style = (selector: string): CSSStyleDeclaration =>
    getComputedStyle(fixture.nativeElement.querySelector(selector));

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => fixture.nativeElement.remove());

  it('renders mat-card on an opaque paper surface', () => {
    const card = style('mat-card');
    expect(card.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(['none', '']).toContain(card.backdropFilter);
  });

  it('uses IBM Plex Sans for Material text', () => {
    expect(style('button').fontFamily).toContain('IBM Plex Sans');
  });

  it('uses the ink color for flat primary buttons', () => {
    expect(style('button').backgroundColor).toBe('rgb(22, 38, 61)');
  });

  it('paints the dialog surface paper white', () => {
    expect(style('.mat-mdc-dialog-surface').backgroundColor).toBe('rgb(255, 255, 255)');
  });

  it('styles toastr success and error from the token pairs', () => {
    const token = (name: string) => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = `var(${name})`;
      fixture.nativeElement.appendChild(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    };
    expect(style('.toast-success').backgroundColor).toBe(token('--lz-success-bg'));
    expect(style('.toast-error').backgroundColor).toBe(token('--lz-danger-bg'));
    expect(style('.toast-success').backgroundColor).toBe('rgb(227, 244, 236)');
  });
});
