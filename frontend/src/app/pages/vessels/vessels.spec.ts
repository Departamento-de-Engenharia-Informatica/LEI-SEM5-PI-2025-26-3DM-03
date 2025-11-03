import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Vessels } from './vessels';

describe('Vessels', () => {
  let component: Vessels;
  let fixture: ComponentFixture<Vessels>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Vessels]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Vessels);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
