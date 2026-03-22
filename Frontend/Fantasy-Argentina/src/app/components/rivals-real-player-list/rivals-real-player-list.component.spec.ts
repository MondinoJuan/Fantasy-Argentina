import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RivalsRealPlayerListComponent } from './rivals-real-player-list.component';

describe('RivalsRealPlayerListComponent', () => {
  let component: RivalsRealPlayerListComponent;
  let fixture: ComponentFixture<RivalsRealPlayerListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RivalsRealPlayerListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RivalsRealPlayerListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
