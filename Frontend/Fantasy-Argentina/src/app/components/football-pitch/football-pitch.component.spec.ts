import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FootballPitchComponent } from './football-pitch.component';

describe('FootballPitchComponent', () => {
  let component: FootballPitchComponent;
  let fixture: ComponentFixture<FootballPitchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FootballPitchComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FootballPitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
