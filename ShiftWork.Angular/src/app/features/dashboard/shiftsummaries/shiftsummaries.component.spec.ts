import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShiftsummariesComponent } from './shiftsummaries.component';

describe('ShiftsummariesComponent', () => {
  let component: ShiftsummariesComponent;
  let fixture: ComponentFixture<ShiftsummariesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShiftsummariesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShiftsummariesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
