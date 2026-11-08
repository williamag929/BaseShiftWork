import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatToolbarModule],
  template: `
    <mat-toolbar>Title</mat-toolbar>
    <mat-card>Card</mat-card>
    <button mat-flat-button>Save</button>
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
});
