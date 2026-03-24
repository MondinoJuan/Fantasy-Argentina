import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RealPlayerMarketCardComponent } from './real-player-market-card.component';

describe('RealPlayerMarketCardComponent', () => {
  let component: RealPlayerMarketCardComponent;
  let fixture: ComponentFixture<RealPlayerMarketCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RealPlayerMarketCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RealPlayerMarketCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
