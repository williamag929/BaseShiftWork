import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LzKpiCardComponent, type LzTrendTone } from './lz-kpi-card.component';

@Component({
  standalone: true,
  imports: [LzKpiCardComponent],
  template: `<lz-kpi-card icon="badge" value="12" label="Active staff" description="On shift now" trend="80% on shift" [trendTone]="tone" />`,
})
class HostComponent {
  tone: LzTrendTone = 'positive';
}

describe('LzKpiCardComponent', () => {
  it('renders value, label, description and a raised card', () => {
    const f = TestBed.createComponent(HostComponent);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const card = f.nativeElement.querySelector('lz-kpi-card') as HTMLElement;
    expect(card.textContent).toContain('12');
    expect(card.textContent).toContain('Active staff');
    expect(card.textContent).toContain('On shift now');
    expect(getComputedStyle(card).boxShadow).not.toBe('none');
    f.nativeElement.remove();
  });

  it('trend judgement is carried by an icon, not only color', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const icon = () => f.nativeElement.querySelector('[data-testid="kpi-trend"] mat-icon').textContent.trim();
    expect(icon()).toBe('check_circle');
    f.componentInstance.tone = 'negative';
    f.changeDetectorRef.detectChanges();
    f.detectChanges();
    expect(icon()).toBe('error');
  });
});
