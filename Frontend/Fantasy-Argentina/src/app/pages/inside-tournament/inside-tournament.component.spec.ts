import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InsideTournamentComponent } from './inside-tournament.component';

describe('InsideTournamentComponent', () => {
  let component: InsideTournamentComponent;
  let fixture: ComponentFixture<InsideTournamentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InsideTournamentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InsideTournamentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
