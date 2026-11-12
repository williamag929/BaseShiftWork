import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LZ_PAGE_CONTEXT, LzPageContext, LzPageHeaderComponent } from './lz-page-header.component';

@Component({
  standalone: true,
  imports: [LzPageHeaderComponent],
  template: `
    <lz-page-header title="Schedule" subtitle="Week of Nov 8">
      <span lzHeaderMeta id="meta">meta</span>
      <button lzHeaderActions id="act">Publish</button>
    </lz-page-header>
  `,
})
class HostComponent {}

describe('LzPageHeaderComponent', () => {
  let root: HTMLElement;
  beforeEach(() => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    root = f.nativeElement;
  });

  it('renders title as h1', () => {
    expect(root.querySelector('h1')!.textContent!.trim()).toBe('Schedule');
    expect(root.textContent).toContain('Week of Nov 8');
  });

  it('projects actions into the right slot', () => {
    const slot = root.querySelector('#act')!.parentElement!;
    expect(slot.classList.contains('ml-auto')).toBeTrue();
    expect(root.querySelector('#meta')).not.toBeNull();
  });
});

describe('LzPageHeaderComponent native tooltip', () => {
  it('does not leave a title attribute on the host when the input is set statically', () => {
    @Component({ standalone: true, imports: [LzPageHeaderComponent], template: `<lz-page-header title="People"></lz-page-header>` })
    class TitleHost {}
    const f = TestBed.createComponent(TitleHost);
    f.detectChanges();
    expect(f.nativeElement.querySelector('lz-page-header').hasAttribute('title')).toBeFalse();
  });
});

@Component({ selector: 'lz-h-card', standalone: true, imports: [LzPageHeaderComponent], template: `<lz-page-header title="Crews"></lz-page-header>` })
class CardHost {}
@Component({ selector: 'lz-h-own', standalone: true, imports: [LzPageHeaderComponent], template: `<lz-page-header title="X" eyebrow="Own"></lz-page-header>` })
class OwnEyebrowHost {}
@Component({ selector: 'lz-h-hero', standalone: true, imports: [LzPageHeaderComponent], template: `<lz-page-header variant="hero" title="Overview"></lz-page-header>` })
class HeroHost {}

describe('LzPageHeaderComponent design language', () => {
  function render(host: any, providers: any[] = []) {
    TestBed.configureTestingModule({ providers });
    const f = TestBed.createComponent(host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    return f;
  }

  it('is a raised paper card by default', () => {
    const f = render(CardHost);
    const host = f.nativeElement.querySelector('lz-page-header') as HTMLElement;
    const cs = getComputedStyle(host);
    expect(cs.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(cs.boxShadow).not.toBe('none');
    expect(cs.borderTopLeftRadius).toBe('12px');
    f.nativeElement.remove();
  });

  it('takes eyebrow and icon from LZ_PAGE_CONTEXT', () => {
    const ctx = signal<LzPageContext | null>({ eyebrow: 'Workforce', icon: 'group_work' });
    const f = render(CardHost, [{ provide: LZ_PAGE_CONTEXT, useValue: ctx }]);
    const eyebrow = f.nativeElement.querySelector('[data-testid="page-eyebrow"]') as HTMLElement;
    expect(eyebrow.textContent!.trim()).toBe('Workforce');
    expect(getComputedStyle(eyebrow).textTransform).toBe('uppercase');
    expect(f.nativeElement.querySelector('lz-icon-tile mat-icon').textContent.trim()).toBe('group_work');
    ctx.set(null);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="page-eyebrow"]')).toBeNull();
    f.nativeElement.remove();
  });

  it('explicit eyebrow overrides the context', () => {
    const ctx = signal<LzPageContext | null>({ eyebrow: 'Workforce', icon: 'group_work' });
    const f = render(OwnEyebrowHost, [{ provide: LZ_PAGE_CONTEXT, useValue: ctx }]);
    expect(f.nativeElement.querySelector('[data-testid="page-eyebrow"]').textContent.trim()).toBe('Own');
    f.nativeElement.remove();
  });

  it('hero variant is the navy command band with paper text', () => {
    const f = render(HeroHost);
    const host = f.nativeElement.querySelector('lz-page-header') as HTMLElement;
    expect(getComputedStyle(host).backgroundImage).toContain('gradient');
    expect(getComputedStyle(host.querySelector('h1')!).color).toBe('rgb(255, 255, 255)');
    f.nativeElement.remove();
  });
});
